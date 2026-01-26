# EIDOLON-V PHASE3: Terraform Variables
# Configuration for cloud deployment

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
  
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "db_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
  
  validation {
    condition     = length(var.db_password) >= 16
    error_message = "Database password must be at least 16 characters long."
  }
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "colorjellyrush.com"
}

variable "ssl_certificate_arn" {
  description = "ARN of SSL certificate for HTTPS"
  type        = string
  default     = ""
}

variable "cluster_version" {
  description = "EKS cluster version"
  type        = string
  default     = "1.28"
}

variable "node_instance_types" {
  description = "EC2 instance types for EKS nodes"
  type        = list(string)
  default     = ["t3.medium", "t3.large"]
}

variable "desired_capacity" {
  description = "Desired number of EKS nodes"
  type        = number
  default     = 3
  
  validation {
    condition     = var.desired_capacity >= 1 && var.desired_capacity <= 20
    error_message = "Desired capacity must be between 1 and 20."
  }
}

variable "max_capacity" {
  description = "Maximum number of EKS nodes"
  type        = number
  default     = 10
  
  validation {
    condition     = var.max_capacity >= var.desired_capacity
    error_message = "Max capacity must be greater than or equal to desired capacity."
  }
}

variable "min_capacity" {
  description = "Minimum number of EKS nodes"
  type        = number
  default     = 2
  
  validation {
    condition     = var.min_capacity <= var.desired_capacity
    error_message = "Min capacity must be less than or equal to desired capacity."
  }
}

variable "enable_monitoring" {
  description = "Enable CloudWatch monitoring"
  type        = bool
  default     = true
}

variable "enable_logging" {
  description = "Enable CloudWatch logging"
  type        = bool
  default     = true
}

variable "enable_backup" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
  
  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 365
    error_message = "Backup retention must be between 1 and 365 days."
  }
}

variable "enable_encryption" {
  description = "Enable encryption for sensitive data"
  type        = bool
  default     = true
}

variable "enable_cdn" {
  description = "Enable CloudFront CDN"
  type        = bool
  default     = true
}

variable "enable_waf" {
  description = "Enable AWS WAF"
  type        = bool
  default     = true
}

variable "enable_ddos_protection" {
  description = "Enable AWS Shield Advanced DDoS protection"
  type        = bool
  default     = false
}

variable "cost_center" {
  description = "Cost center for billing"
  type        = string
  default     = "engineering"
}

variable "project_name" {
  description = "Project name for resource tagging"
  type        = string
  default     = "color-jelly-rush"
}

variable "owner" {
  description = "Owner of the resources"
  type        = string
  default     = "devops-team"
}

variable "tags" {
  description = "Additional tags for all resources"
  type        = map(string)
  default     = {}
}

# Locals for common tags
locals {
  common_tags = merge(
    {
      Environment = var.environment
      Project     = var.project_name
      Owner       = var.owner
      CostCenter  = var.cost_center
    },
    var.tags
  )
}
