# MREDEO Backend - Production Grade Node.js Application

## Project Overview

MREDEO Backend is a production-ready Node.js API built for the MREDEO Educational Officers Union. It provides comprehensive functionality for member management, payment processing, notifications, and administrative operations.

## Features

- 🔐 **Secure Authentication**: JWT-based authentication with refresh tokens
- 👥 **User Management**: Member registration, profile management, role-based access
- 💰 **Payment Processing**: Contribution payments, payment history, admin payment issuance
- 🔔 **Notification System**: Admin-to-member notifications with read status tracking
- 📊 **Admin Dashboard**: Payment reports, user management, contribution type management
- 🛡️ **Security**: Rate limiting, input validation, audit logging, GDPR compliance
- 📱 **Mobile Ready**: RESTful API designed for Flutter mobile app integration

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Express Validator
- **File Upload**: Multer
- **Password Hashing**: bcrypt
- **Environment**: dotenv

## Quick Start

### Prerequisites
- Node.js 18 or higher
- PostgreSQL database
- npm or yarn package manager

### Installation

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd mredeo-backend
   npm install
   ```

2. **Environment setup**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database setup**:
   - Create PostgreSQL database
   - Run database migrations (see Database Schema section)

4. **Start the server**:
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/signup` | Register new user |
| POST | `/auth/verify-otp` | Verify phone number |
| POST | `/auth/login` | User login |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password with OTP |
| POST | `/auth/refresh-token` | Refresh access token |
| POST | `/auth/logout` | User logout |

### Profile Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile` | Get user profile |
| PUT | `/profile` | Update profile |
| POST | `/profile/upload-picture` | Upload profile picture |
| PUT | `/profile/change-password` | Change password |
| PUT | `/profile/settings` | Update user settings |
| DELETE | `/profile/delete-account` | Delete account |
| GET | `/profile/export-data` | Export user data (GDPR) |

### Payment Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/payments` | Make payment (member) |
| GET | `/payments/history` | Payment history (member) |
| GET | `/payments/:id` | Payment details (member) |
| POST | `/payments/issue` | Issue payment (admin) |
| GET | `/payments/admin/report` | Payments report (admin) |

### Contribution Types
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/contributions` | List contribution types |
| POST | `/contributions` | Create contribution type (admin) |
| PUT | `/contributions/:id` | Update contribution type (admin) |
| DELETE | `/contributions/:id` | Delete contribution type (admin) |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | Get notifications |
| POST | `/notifications` | Send notification (admin) |
| PUT | `/notifications/:id/read` | Mark as read |
| PUT | `/notifications/read-all` | Mark all as read |

## Security Features

### Authentication & Authorization
- JWT access tokens (24h expiry)
- Refresh tokens (7d expiry)
- Role-based access control (RBAC)
- Password strength requirements
- OTP verification for critical operations

### Security Middleware
- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: API abuse prevention
- **Input Validation**: XSS and injection prevention
- **Audit Logging**: Action tracking and compliance

### Data Protection
- Password hashing with bcrypt
- Sensitive data redaction in logs
- GDPR compliance with data export
- Soft delete for data retention

## Environment Variables

```env
# Server Configuration
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mredeo_db
DB_USER=username
DB_PASSWORD=password

# JWT Security
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d

# Security Settings
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# External Services
SMS_API_KEY=your-sms-provider-api-key
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-email-password

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads
```

## Database Schema

### Required Tables

1. **users**: User accounts and profiles
2. **user_settings**: User preferences and settings
3. **otps**: One-time passwords for verification
4. **contribution_types**: Payment contribution categories
5. **payments**: Payment transactions
6. **issued_payments**: Admin-issued payments
7. **notifications**: System notifications
8. **notification_reads**: Notification read status
9. **audit_logs**: System activity logging

### Sample PostgreSQL Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    profile_picture VARCHAR(500),
    role VARCHAR(20) DEFAULT 'member',
    is_active BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OTPs table
CREATE TABLE otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    otp_code VARCHAR(6) NOT NULL,
    purpose VARCHAR(20) NOT NULL,
    verified BOOLEAN DEFAULT false,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contribution types table
CREATE TABLE contribution_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    contribution_type_id UUID REFERENCES contribution_types(id),
    amount_paid DECIMAL(10,2) NOT NULL,
    telco VARCHAR(20) NOT NULL,
    phone_number_used VARCHAR(20) NOT NULL,
    transaction_reference VARCHAR(100) UNIQUE NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending',
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add other tables as needed...
```

## Flutter Integration Guide

### HTTP Client Setup
```dart
import 'package:dio/dio.dart';

class ApiService {
  final Dio _dio = Dio();
  
  ApiService() {
    _dio.options.baseUrl = 'http://your-api-domain.com/api/v1';
    _dio.interceptors.add(AuthInterceptor());
  }
}
```

### Authentication Flow
1. User registration with phone verification
2. OTP verification to activate account
3. Login to receive JWT tokens
4. Automatic token refresh on expiry
5. Secure token storage

### Best Practices
- Use `flutter_secure_storage` for token storage
- Implement automatic retry on network failures
- Handle offline scenarios gracefully
- Validate inputs on both client and server
- Implement proper error handling and user feedback

## Development

### Project Structure
```
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── middleware/      # Custom middleware
├── models/          # Database models
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Utility functions
└── app.js          # Express app setup
```

### Scripts
```bash
npm run dev          # Development with auto-reload
npm start           # Production server
npm test            # Run tests
npm run lint        # Code linting
npm run lint:fix    # Fix linting issues
```

### Code Style
- ES6+ JavaScript
- Async/await for asynchronous operations
- Consistent error handling
- Comprehensive input validation
- Security-first approach

## Deployment

### Production Checklist
- [ ] Set NODE_ENV=production
- [ ] Configure secure database connection
- [ ] Set strong JWT secrets
- [ ] Configure SSL/TLS
- [ ] Set up monitoring and logging
- [ ] Configure backup strategies
- [ ] Set up CI/CD pipeline

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## Monitoring & Maintenance

### Health Checks
- API health endpoint: `/api/v1/health`
- Database connection monitoring
- Memory and CPU usage tracking

### Logging
- Request/response logging with Morgan
- Error logging with stack traces
- Audit trail for security events
- Performance metrics collection

## Support & Documentation

### API Testing
Use tools like Postman or Insomnia to test API endpoints. Import the provided API collection for quick setup.

### Troubleshooting
- Check logs for error details
- Verify database connectivity
- Ensure environment variables are set
- Check rate limiting if requests are blocked

### Contributing
1. Fork the repository
2. Create feature branch
3. Implement changes with tests
4. Submit pull request with description

## License

This project is proprietary software for MREDEO Educational Officers Union.

---

**Contact**: For technical support or questions, contact the development team.
