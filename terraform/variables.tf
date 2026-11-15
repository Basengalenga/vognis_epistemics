variable "aws_region" {
  description = "Region for the machine and for Bedrock."
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "Small size with enough memory to build the images."
  type        = string
  default     = "t3.small"
}

variable "bedrock_token" {
  description = "Bedrock API key. Same value as AWS_BEDROCK_TOKEN."
  type        = string
  sensitive   = true
}

variable "git_repo" {
  description = "Repository the machine clones."
  type        = string
  default     = "https://github.com/Basengalenga/vognis_epistemics.git"
}

variable "git_ref" {
  description = "Branch or tag to run."
  type        = string
  default     = "main"
}

variable "git_token" {
  description = "GitHub token. Leave empty if the repository is public."
  type        = string
  default     = ""
  sensitive   = true
}
