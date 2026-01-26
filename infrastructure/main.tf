# EIDOLON-V PHASE3: Terraform Cloud Deployment
# AWS Infrastructure as Code

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  token                  = data.aws_eks_cluster_auth.cjrs.token
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
    token                  = data.aws_eks_cluster_auth.cjrs.token
  }
}

# VPC Configuration
resource "aws_vpc" "cjr_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "cjr-vpc"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "cjr_igw" {
  vpc_id = aws_vpc.cjr_vpc.id

  tags = {
    Name        = "cjr-igw"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

# Public Subnets
resource "aws_subnet" "cjr_public_subnets" {
  count = 3

  vpc_id                  = aws_vpc.cjr_vpc.id
  cidr_block              = "10.0.${count.index}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "cjr-public-subnet-${count.index}"
    Environment = var.environment
    Project     = "color-jelly-rush"
    Type        = "Public"
  }
}

# Private Subnets
resource "aws_subnet" "cjr_private_subnets" {
  count = 3

  vpc_id            = aws_vpc.cjr_vpc.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name        = "cjr-private-subnet-${count.index}"
    Environment = var.environment
    Project     = "color-jelly-rush"
    Type        = "Private"
  }
}

# NAT Gateways
resource "aws_nat_gateway" "cjr_nat_gateways" {
  count = 3

  allocation_id = aws_eip.cjr_eips[count.index].id
  subnet_id     = aws_subnet.cjr_public_subnets[count.index].id

  tags = {
    Name        = "cjr-nat-gateway-${count.index}"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }

  depends_on = [aws_internet_gateway.cjr_igw]
}

# Elastic IPs for NAT Gateways
resource "aws_eip" "cjr_eips" {
  count = 3

  domain = "vpc"

  tags = {
    Name        = "cjr-eip-${count.index}"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }

  depends_on = [aws_internet_gateway.cjr_igw]
}

# Route Tables
resource "aws_route_table" "cjr_public_rt" {
  vpc_id = aws_vpc.cjr_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.cjr_igw.id
  }

  tags = {
    Name        = "cjr-public-rt"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

resource "aws_route_table" "cjr_private_rt" {
  count = 3

  vpc_id = aws_vpc.cjr_vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.cjr_nat_gateways[count.index].id
  }

  tags = {
    Name        = "cjr-private-rt-${count.index}"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

# Route Table Associations
resource "aws_route_table_association" "cjr_public_rta" {
  count = 3

  subnet_id      = aws_subnet.cjr_public_subnets[count.index].id
  route_table_id = aws_route_table.cjr_public_rt.id
}

resource "aws_route_table_association" "cjr_private_rta" {
  count = 3

  subnet_id      = aws_subnet.cjr_private_subnets[count.index].id
  route_table_id = aws_route_table.cjr_private_rt[count.index].id
}

# EKS Cluster
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "cjr-eks-cluster"
  cluster_version = "1.28"

  vpc_id          = aws_vpc.cjr_vpc.id
  subnet_ids      = aws_subnet.cjr_private_subnets[*].id

  cluster_endpoint_public_access = true

  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  node_groups = {
    cjr_nodes = {
      desired_capacity = 3
      max_capacity     = 10
      min_capacity     = 2

      instance_types = ["t3.medium", "t3.large"]
      k8s_labels = {
        Environment = var.environment
        Project     = "color-jelly-rush"
      }
    }

    cjr_game_nodes = {
      desired_capacity = 2
      max_capacity     = 8
      min_capacity     = 1

      instance_types = ["t3.large", "t3.xlarge"]
      k8s_labels = {
        Environment = var.environment
        Project     = "color-jelly-rush"
        NodePool    = "game"
      }
    }
  }

  tags = {
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

# EKS Cluster Auth Data
data "aws_eks_cluster_auth" "cjrs" {
  name = module.eks.cluster_name
}

# RDS PostgreSQL
resource "aws_db_subnet_group" "cjr_db_subnet_group" {
  name       = "cjr-db-subnet-group"
  subnet_ids = aws_subnet.cjr_private_subnets[*].id

  tags = {
    Name        = "cjr-db-subnet-group"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

resource "aws_security_group" "cjr_db_sg" {
  name        = "cjr-db-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = aws_vpc.cjr_vpc.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.cjr_vpc.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "cjr-db-sg"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

resource "aws_db_instance" "cjr_postgres" {
  identifier = "cjr-postgres"
  
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.medium"
  
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_encrypted     = true
  storage_type          = "gp2"
  
  db_name  = "color_jelly_rush"
  username = "cjr_user"
  password = var.db_password
  
  db_subnet_group_name = aws_db_subnet_group.cjr_db_subnet_group.name
  vpc_security_group_ids = [aws_security_group.cjr_db_sg.id]
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  skip_final_snapshot = false
  final_snapshot_identifier = "cjr-postgres-final-snapshot"
  
  tags = {
    Name        = "cjr-postgres"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

# ElastiCache Redis
resource "aws_elasticache_subnet_group" "cjr_redis_subnet_group" {
  name       = "cjr-redis-subnet-group"
  subnet_ids = aws_subnet.cjr_private_subnets[*].id

  tags = {
    Name        = "cjr-redis-subnet-group"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

resource "aws_security_group" "cjr_redis_sg" {
  name        = "cjr-redis-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = aws_vpc.cjr_vpc.id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.cjr_vpc.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "cjr-redis-sg"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

resource "aws_elasticache_replication_group" "cjr_redis" {
  replication_group_id       = "cjr-redis"
  description               = "Redis cluster for Color Jelly Rush"
  
  node_type                  = "cache.t3.micro"
  port                       = 6379
  parameter_group_name       = "default.redis7"
  
  subnet_group_name          = aws_elasticache_subnet_group.cjr_redis_subnet_group.name
  security_group_ids        = [aws_security_group.cjr_redis_sg.id]
  
  automatic_failover_enabled = true
  multi_az_enabled          = true
  num_cache_clusters         = 1
  
  at_rest_encryption_enabled = true
  
  tags = {
    Name        = "cjr-redis"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

# Application Load Balancer
resource "aws_lb" "cjr_alb" {
  name               = "cjr-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.cjr_alb_sg.id]
  subnets            = aws_subnet.cjr_public_subnets[*].id

  enable_deletion_protection = false

  tags = {
    Name        = "cjr-alb"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

resource "aws_security_group" "cjr_alb_sg" {
  name        = "cjr-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.cjr_vpc.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "cjr-alb-sg"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

# Target Group for API Gateway
resource "aws_lb_target_group" "cjr_api_tg" {
  name     = "cjr-api-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.cjr_vpc.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name        = "cjr-api-tg"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

# Target Group for Game Service WebSocket
resource "aws_lb_target_group" "cjr_game_tg" {
  name     = "cjr-game-tg"
  port     = 2567
  protocol = "HTTP"
  vpc_id   = aws_vpc.cjr_vpc.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name        = "cjr-game-tg"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

# Load Balancer Listener
resource "aws_lb_listener" "cjr_http" {
  load_balancer_arn = aws_lb.cjr_alb.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "cjr_https" {
  load_balancer_arn = aws_lb.cjr_alb.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn  = aws_acm_certificate.cjr_cert.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.cjr_api_tg.arn
  }
}

# ACM Certificate
resource "aws_acm_certificate" "cjr_cert" {
  domain_name       = "colorjellyrush.com"
  validation_method = "DNS"

  subject_alternative_names = [
    "*.colorjellyrush.com",
    "api.colorjellyrush.com"
  ]

  tags = {
    Name        = "cjr-cert"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

# Route 53 Hosted Zone
resource "aws_route53_zone" "cjr_zone" {
  name = "colorjellyrush.com"

  tags = {
    Name        = "cjr-zone"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

# DNS Records
resource "aws_route53_record" "cjr_root" {
  zone_id = aws_route53_zone.cjr_zone.zone_id
  name    = "colorjellyrush.com"
  type    = "A"

  alias {
    name                   = aws_lb.cjr_alb.dns_name
    zone_id                = aws_lb.cjr_alb.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "cjr_api" {
  zone_id = aws_route53_zone.cjr_zone.zone_id
  name    = "api.colorjellyrush.com"
  type    = "CNAME"
  ttl     = 300
  records = [aws_lb.cjr_alb.dns_name]
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "cjr_logs" {
  name              = "/aws/color-jelly-rush"
  retention_in_days = 30

  tags = {
    Name        = "cjr-logs"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

# S3 Bucket for static assets
resource "aws_s3_bucket" "cjr_assets" {
  bucket = "colorjellyrush-assets-${var.environment}"

  tags = {
    Name        = "cjr-assets"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

resource "aws_s3_bucket_public_access_block" "cjr_assets_pab" {
  bucket = aws_s3_bucket.cjr_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_website_configuration" "cjr_assets_website" {
  bucket = aws_s3_bucket.cjr_assets.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    suffix = "error.html"
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "cjr_cdn" {
  origin {
    domain_name = aws_s3_bucket.cjr_assets.bucket_regional_domain_name
    origin_id   = "S3-cjr-assets"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.cjr_oai.cloudfront_access_identity_path
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-cjr-assets"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      headers      = ["*"]

      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    ssl_support_method = "sni-only"
  }

  tags = {
    Name        = "cjr-cdn"
    Environment = var.environment
    Project     = "color-jelly-rush"
  }
}

resource "aws_cloudfront_origin_access_identity" "cjr_oai" {
  comment = "OAI for Color Jelly Rush S3 bucket"
}

# Data Sources
data "aws_availability_zones" "available" {
  state = "available"
}
