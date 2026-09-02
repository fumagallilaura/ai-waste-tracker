# IAM Role for EC2
resource "aws_iam_role" "ec2" {
  name = "${var.app_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Policy for S3 backup access
resource "aws_iam_role_policy" "ec2_s3_backup" {
  name = "${var.app_name}-ec2-s3-backup"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.backups.arn,
          "${aws_s3_bucket.backups.arn}/*"
        ]
      }
    ]
  })
}

# IAM Policy for SSM access
resource "aws_iam_role_policy" "ec2_ssm" {
  name = "${var.app_name}-ec2-ssm"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.app_name}/*"
      }
    ]
  })
}

# Instance Profile
resource "aws_iam_instance_profile" "ec2" {
  name = "${var.app_name}-ec2-profile"
  role = aws_iam_role.ec2.name
}

# Data source for current account
data "aws_caller_identity" "current" {}

# EC2 Instance
resource "aws_instance" "backend" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t4g.micro"
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  key_name               = var.ec2_key_pair_name

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true

    tags = {
      Name = "${var.app_name}-backend-root"
    }
  }

  user_data = <<-EOF
              #!/bin/bash
              set -e

              # Update system
              apt-get update
              apt-get upgrade -y

              # Install PostgreSQL 16
              apt-get install -y postgresql-16 postgresql-client-16

              # Configure PostgreSQL
              systemctl enable postgresql
              systemctl start postgresql

              # Create database and user
              sudo -u postgres psql << 'PSQL'
              CREATE USER desperdicio WITH PASSWORD '${var.db_password}';
              CREATE DATABASE desperdicio_zero OWNER desperdicio;
              GRANT ALL PRIVILEGES ON DATABASE desperdicio_zero TO desperdicio;
              PSQL

              # Install Python 3.12
              apt-get install -y python3.12 python3.12-venv python3.12-dev

              # Install backup tools
              apt-get install -y awscli

              # Setup backup script
              cat > /usr/local/bin/backup-postgres.sh << 'BACKUP'
              #!/bin/bash
              set -e
              TIMESTAMP=$(date +%Y%m%d_%H%M%S)
              BACKUP_FILE="/tmp/desperdicio_zero_${TIMESTAMP}.sql.gz"
              pg_dump -U desperdicio desperdicio_zero | gzip > $BACKUP_FILE
              aws s3 cp $BACKUP_FILE s3://${aws_s3_bucket.backups.id}/backups/
              rm $BACKUP_FILE
              BACKUP

              chmod +x /usr/local/bin/backup-postgres.sh

              # Add cron job for daily backup at 2 AM
              (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-postgres.sh") | crontab -

              # Install FastAPI dependencies (will be done by deploy script)
              # mkdir -p /opt/desperdicio-zero
              # cd /opt/desperdicio-zero
              # python3.12 -m venv venv
              # source venv/bin/activate
              # pip install -r requirements.txt

              echo "EC2 setup complete"
              EOF

  tags = {
    Name = "${var.app_name}-backend"
  }
}

# AMI Data Source
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]  # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-arm64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

variable "ec2_key_pair_name" {
  description = "EC2 key pair name for SSH access"
  type        = string
  default     = "desperdicio-zero-key"
}
