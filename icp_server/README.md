# WSO2 Integrator: ICP Server

The Integration Control Plane (ICP) Server is a Ballerina-based backend service that provides comprehensive management and orchestration capabilities for WSO2 integrations.

## Overview

The ICP Server consists of the following core services:

- **GraphQL API Service** - Provides a GraphQL endpoint for frontend interactions and data queries
- **Runtime Service** - Manages integration runtime instances and their lifecycle
- **Authentication Service** - Handles user authentication and authorization with JWT-based security

## Running the Server Locally

### Prerequisites
- Docker and Docker Compose
- Ballerina (for local development without Docker)

### Using Docker Compose

To run the server with all dependencies:

**MySQL:**
```sh
docker-compose -f docker-compose.local.yml up --build
```

**MSSQL:**
```sh
docker-compose -f docker-compose.mssql.yml up --build
```

This will start:
- Database (MySQL on port 3307 or MSSQL on port 1433)
- ICP Server on ports:
  - 9445 - Main HTTP/GraphQL API
  - 9446 - GraphQL endpoint
  - 9447 - Authentication backend service

### Running Locally (Without Docker)

```sh
bal run
```

Make sure to configure the database connection in `Config.toml` before running.

## Database Support

The ICP Server supports multiple database backends:

- **MySQL** - Production-ready relational database
  - Default port: 3306
  - Config: Set `dbType = "mysql"` in Config.toml
  - Docker Compose: `docker-compose.mysql.yml`

- **Microsoft SQL Server (MSSQL)** - Enterprise database
  - Default port: 1433
  - Config: Set `dbType = "mssql"` in Config.toml
  - Docker Compose: `docker-compose.mssql.yml`

- **H2** - In-memory database for development/testing
  - Config: Set `dbType = "h2"` in Config.toml
  - No external database required

## Running Tests

To run the test suite using Docker Compose:

```sh
docker-compose -f docker-compose.test.yml up --build
```

This will:
- Start a test MySQL database
- Run all Ballerina tests
- Execute authentication, runtime, and GraphQL API tests

### Running Tests Locally

```sh
bal test
```

Test configuration is located in `tests/Config.toml`.
