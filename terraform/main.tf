# Prototype only: one EC2 in the default VPC. No load balancer, no custom network.
#
#   cd terraform
#   cp terraform.tfvars.example terraform.tfvars
#   terraform init
#   terraform apply
#
# The machine clones main from GitHub and builds the images on first boot.
# Push the commit you want to run before applying. The first build takes a few minutes.
# Then: terraform output url

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-2023*-x86_64"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_security_group" "vognis" {
  name        = "vognis-prototype"
  description = "Prototype: the page and the API"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Page"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "API"
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "vognis" {
  ami                         = data.aws_ami.al2023.id
  instance_type               = var.instance_type
  subnet_id                   = data.aws_subnets.default.ids[0]
  vpc_security_group_ids      = [aws_security_group.vognis.id]
  associate_public_ip_address = true
  user_data_replace_on_change = true

  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    git_ref = var.git_ref
    git_clone_url = (
      var.git_token == ""
      ? var.git_repo
      : "https://x-access-token:${var.git_token}@${trimprefix(var.git_repo, "https://")}"
    )
    env_file = "AWS_BEDROCK_TOKEN=${var.bedrock_token}\nAWS_REGION=${var.aws_region}\n"
  })

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  tags = {
    Name = "vognis-prototype"
  }
}
