FROM --platform=linux/amd64 public.ecr.aws/amazonlinux/amazonlinux:2023

# Install development tools
RUN yum update -y \
    && yum install -y which unzip tree make jq tar gzip shadow-utils git gcc gcc-c++ cmake3 clang-devel python3 python3-pip zip procps pkgconfig \
    && yum install openssl openssl-devel -y \
    && yum groupinstall "Development Tools" -y

# Install node
RUN mkdir -p software/node \
    && cd software/node \
    && yum install https://rpm.nodesource.com/pub_20.x/nodistro/repo/nodesource-release-nodistro-1.noarch.rpm -y \
    && yum install nodejs -y --setopt=nodesource-nodejs.module_hotfixes=1 \
    && npm install -g ts-node@10.4.0


WORKDIR /

COPY . .

RUN npm ci

ENTRYPOINT ["npm", "run", "basic"]
