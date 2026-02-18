# WSO2 Integration Control Plane

Monitor, troubleshoot, and control integration deployments with a modern GraphQL API and real-time observability.

## Architecture

The Integration Control Plane consists of:

- **Backend (ICP Server)**: Ballerina-based GraphQL API service with authentication, runtime management, and observability
- **Frontend**: Modern React + TypeScript application with Vite and Oxygen UI components
- **Database Support**: MySQL, PostgreSQL, Microsoft SQL Server, or H2 (in-memory)

## Quick Start

### Prerequisites

- **Java 17+** (for Gradle)
- **Ballerina** (latest stable version)
- **Node.js 20+** and **pnpm 10+**
- **Docker & Docker Compose** (recommended for local development)

### Running with Docker Compose

The easiest way to get started is using Docker Compose, which sets up the complete stack:

```bash
# With MySQL database
docker-compose -f icp_server/docker-compose.mysql.yml up --build

# With PostgreSQL database
docker-compose -f icp_server/docker-compose.postgresql.yml up --build

# With MSSQL database
docker-compose -f icp_server/docker-compose.mssql.yml up --build
```

The services will be available at:

- **Frontend**: http://localhost:5173
- **GraphQL API**: https://localhost:9446/graphql
- **Authentication API**: https://localhost:9445/auth
- **Observability API**: https://localhost:9448/icp/observability

Default credentials: `admin` / `admin`

## Building from Source

### Complete Build

Build the entire project using Gradle:

```bash
./gradlew build
```

Or use the build script:

```bash
./build.sh
```

The distribution package will be created in:

```
build/distribution/wso2-integrator-icp-<version>/
```

### Running the Distribution

After building, you can run the packaged distribution:

```bash
cd build/distribution/wso2-integrator-icp-<version>/bin
./icp.sh start    # Linux/macOS
icp.bat start     # Windows
```

## Development Setup

### Backend Development

Navigate to the backend directory:

```bash
cd icp_server
```

#### Using Docker Compose (Recommended)

```bash
# Start with local configuration (H2 database)
docker-compose -f docker-compose.local.yml up --build

# Start with MySQL
docker-compose -f docker-compose.mysql.yml up --build

# Start with observability stack (Prometheus, Grafana)
docker-compose -f docker-compose.observability.yml up --build
```

#### Running Locally with Ballerina

1. Configure the database in `icp_server/Config.toml`
2. Run the service:

```bash
bal run
```

The server will start on:

- Port 9445 - Main HTTP API
- Port 9446 - GraphQL endpoint
- Port 9447 - Authentication backend service
- Port 9448 - Observability service

### Frontend Development

Navigate to the frontend directory:

```bash
cd frontend
```

#### Install Dependencies

```bash
pnpm install
```

#### Configure Backend URLs

Edit `frontend/public/config.json`:

```json
{
  "VITE_GRAPHQL_URL": "https://localhost:9446/graphql",
  "VITE_AUTH_BASE_URL": "https://localhost:9445/auth",
  "VITE_OBSERVABILITY_URL": "https://localhost:9448/icp/observability"
}
```

#### Start Development Server

```bash
pnpm dev
```

The frontend will be available at http://localhost:5173

#### Build for Production

```bash
pnpm build
```

The production build will be in `frontend/dist/`

## Database Configuration

The ICP Server supports multiple database backends:

### MySQL

```toml
# icp_server/Config.toml
[icp_server.storage]
dbType = "mysql"
host = "localhost"
port = 3306
name = "icp_db"
username = "root"
password = "root"
```

### PostgreSQL

```toml
[icp_server.storage]
dbType = "postgresql"
host = "localhost"
port = 5432
name = "icp_db"
username = "postgres"
password = "postgres"
```

### Microsoft SQL Server

```toml
[icp_server.storage]
dbType = "mssql"
host = "localhost"
port = 1433
name = "icp_db"
username = "SA"
password = "YourStrong@Passw0rd"
```

### H2 (In-Memory)

```toml
[icp_server.storage]
dbType = "h2"
```

## Testing

### Backend Tests

```bash
cd icp_server

# Run all tests
bal test

# Run tests with Docker Compose
docker-compose -f docker-compose.test.yml up --build
```

### Frontend Tests

```bash
cd frontend
pnpm test
```

## Authentication

The ICP supports multiple authentication methods:

- **Default User Backend**: Built-in user management with JWT tokens
- **Custom Auth Backend**: Integration with external OAuth2/OIDC providers
- **LDAP**: Enterprise directory integration

See [icp_server/custom_auth/AUTH_BACKEND_IMPLEMENTATION.md](icp_server/custom_auth/AUTH_BACKEND_IMPLEMENTATION.md) for details.

## Observability

The ICP Server integrates with:

- **OpenSearch**: For log aggregation and search
- **Prometheus**: For metrics collection
- **Grafana**: For visualization

Start the observability stack:

```bash
cd icp_server
docker-compose -f docker-compose.observability.yml up
```

## Documentation

- [Backend Documentation](icp_server/README.md)
- [Frontend Documentation](frontend/README.md)
- [Runtime Configuration](frontend/RUNTIME_CONFIG.md)
- [RBAC v2 Implementation](icp_server/rbac_v2_implementation.md)
- [Kubernetes Deployment](kubernetes/SETUP.md)

## Project Structure

```
integration-control-plane/
├── icp_server/              # Ballerina backend service
│   ├── modules/             # Ballerina modules (auth, storage, observability)
│   ├── tests/               # Backend tests
│   ├── database/            # Database schemas and migrations
│   └── docker-compose.*.yml # Docker Compose configurations
├── frontend/                # React TypeScript frontend
│   ├── src/                 # Source code
│   ├── public/              # Static assets and runtime config
│   └── dist/                # Production build output
├── distribution/            # Distribution scripts
├── kubernetes/              # Kubernetes deployment manifests
└── build.gradle             # Gradle build configuration
```

## Contributing

Please read our [Contributing Guide](CONTRIBUTING.md) before submitting pull requests.

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

## Support

- [Issue Tracker](https://github.com/wso2/integration-control-plane/issues)
- [WSO2 Support](https://wso2.com/support/)
