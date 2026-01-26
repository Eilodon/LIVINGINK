# EIDOLON-V PHASE3: Terraform Outputs
# Export important resource information

output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "cluster_certificate_authority_data" {
  description = "EKS cluster certificate authority data"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.cjr_vpc.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.cjr_public_subnets[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.cjr_private_subnets[*].id
}

output "database_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.cjr_postgres.endpoint
  sensitive   = true
}

output "database_port" {
  description = "RDS PostgreSQL port"
  value       = aws_db_instance.cjr_postgres.port
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = aws_elasticache_replication_group.cjr_redis.primary_endpoint
}

output "redis_port" {
  description = "ElastiCache Redis port"
  value       = aws_elasticache_replication_group.cjr_redis.port
}

output "load_balancer_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = aws_lb.cjr_alb.dns_name
}

output "load_balancer_zone_id" {
  description = "Application Load Balancer zone ID"
  value       = aws_lb.cjr_alb.zone_id
}

output "cdn_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.cjr_cdn.domain_name
}

output "cdn_status" {
  description = "CloudFront distribution status"
  value       = aws_cloudfront_distribution.cjr_cdn.status
}

output "s3_bucket_name" {
  description = "S3 bucket name for static assets"
  value       = aws_s3_bucket.cjr_assets.bucket
}

output "route53_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = aws_route53_zone.cjr_zone.zone_id
}

output "certificate_arn" {
  description = "ACM certificate ARN"
  value       = aws_acm_certificate.cjr_cert.arn
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.cjr_logs.name
}

# Kubernetes Config
output "configure_kubectl" {
  description = "Configure kubectl command"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

# Database Connection String
output "database_connection_string" {
  description = "PostgreSQL connection string"
  value       = "postgresql://${aws_db_instance.cjr_postgres.username}:${var.db_password}@${aws_db_instance.cjr_postgres.endpoint}:${aws_db_instance.cjr_postgres.port}/${aws_db_instance.cjr_postgres.db_name}"
  sensitive   = true
}

# Redis Connection String
output "redis_connection_string" {
  description = "Redis connection string"
  value       = "redis://${aws_elasticache_replication_group.cjr_redis.primary_endpoint}:${aws_elasticache_replication_group.cjr_redis.port}"
}

# API Endpoints
output "api_endpoint" {
  description = "Main API endpoint"
  value       = "https://${var.domain_name}"
}

output "api_internal_endpoint" {
  description = "Internal API endpoint"
  value       = "https://api.${var.domain_name}"
}

# Monitoring Endpoints
output "grafana_endpoint" {
  description = "Grafana monitoring endpoint"
  value       = "https://grafana.${var.domain_name}"
}

output "prometheus_endpoint" {
  description = "Prometheus metrics endpoint"
  value       = "https://prometheus.${var.domain_name}"
}

# Security Information
output "security_group_ids" {
  description = "Security group IDs"
  value = {
    vpc           = aws_vpc.cjr_vpc.default_security_group_id
    database      = aws_security_group.cjr_db_sg.id
    redis         = aws_security_group.cjr_redis_sg.id
    load_balancer = aws_security_group.cjr_alb_sg.id
  }
}

output "nat_gateway_ids" {
  description = "NAT gateway IDs"
  value       = aws_nat_gateway.cjr_nat_gateways[*].id
}

# Cost Information
output "estimated_monthly_cost" {
  description = "Estimated monthly cost in USD"
  value       = {
    eks_cluster    = 150
    rds_postgres   = 75
    elasticache    = 50
    load_balancer  = 25
    cloudfront     = 20
    route53        = 1
    monitoring     = 30
    total          = 351
  }
}

# Deployment Information
output "deployment_info" {
  description = "Deployment information"
  value = {
    environment = var.environment
    region      = var.aws_region
    version     = var.cluster_version
    deployed_at = timestamp()
  }
}

# Health Check URLs
output "health_check_urls" {
  description = "Health check URLs for services"
  value = {
    api_gateway    = "https://${var.domain_name}/health"
    auth_service   = "https://api.${var.domain_name}/auth/health"
    game_service   = "https://api.${var.domain_name}/game/health"
    analytics      = "https://api.${var.domain_name}/analytics/health"
  }
}

# Configuration Commands
output "useful_commands" {
  description = "Useful commands for managing the deployment"
  value = {
    connect_to_cluster = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
    get_cluster_status = "kubectl get nodes"
    get_pods            = "kubectl get pods --all-namespaces"
    get_services        = "kubectl get services --all-namespaces"
    get_ingress         = "kubectl get ingress --all-namespaces"
    get_logs            = "kubectl logs -f deployment/api-gateway -n color-jelly-rush"
    scale_deployment    = "kubectl scale deployment api-gateway --replicas=5 -n color-jelly-rush"
    restart_deployment = "kubectl rollout restart deployment/api-gateway -n color-jelly-rush"
  }
}
