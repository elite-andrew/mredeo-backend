-- MREDEO Backend Database Schema
-- PostgreSQL Database Schema for MREDEO Educational Officers Union Backend

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY NOT NULL,
    firebase_uid VARCHAR(128) UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20) UNIQUE,
    -- password_hash removed in Firebase migration
    profile_picture VARCHAR(500),
    role VARCHAR(30) DEFAULT 'member' CHECK (role IN ('member', 'admin_chairperson', 'admin_secretary', 'admin_signatory')),
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User settings table
CREATE TABLE user_settings (
    id BIGSERIAL PRIMARY KEY NOT NULL,
    user_id BIGSERIAL REFERENCES users(id) ON DELETE CASCADE,
    language VARCHAR(10) DEFAULT 'en',
    dark_mode BOOLEAN DEFAULT false,
    notifications_enabled BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT true,
    consent_to_terms BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- OTPs table
CREATE TABLE otps (
    id BIGSERIAL PRIMARY KEY NOT NULL,
    user_id BIGSERIAL REFERENCES users(id) ON DELETE CASCADE,
    otp_code VARCHAR(6) NOT NULL,
    purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('signup', 'login', 'reset_password')),
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contribution types table
CREATE TABLE contribution_types (
    id BIGSERIAL PRIMARY KEY NOT NULL,
    name VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by BIGSERIAL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY NOT NULL,
    user_id BIGSERIAL REFERENCES users(id) ON DELETE CASCADE,
    contribution_type_id BIGSERIAL REFERENCES contribution_types(id),
    amount_paid DECIMAL(15,2) NOT NULL,
    telco VARCHAR(20) NOT NULL CHECK (telco IN ('vodacom', 'tigo', 'airtel', 'halotel', 'zantel', 'other')),
    phone_number_used VARCHAR(20) NOT NULL,
    transaction_reference VARCHAR(100) UNIQUE NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'success', 'failed', 'cancelled')),
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Issued payments table (admin payments to members)
CREATE TABLE issued_payments (
    id BIGSERIAL PRIMARY KEY NOT NULL,
    issued_by BIGSERIAL REFERENCES users(id),
    issued_to BIGSERIAL REFERENCES users(id),
    amount DECIMAL(15,2) NOT NULL,
    purpose TEXT NOT NULL,
    transaction_reference VARCHAR(100) UNIQUE NOT NULL,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY NOT NULL,
    sender_id BIGSERIAL REFERENCES users(id),
    title VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(20) DEFAULT 'general' CHECK (notification_type IN ('general', 'contribution_request', 'payment_reminder')),
    contribution_type_id BIGSERIAL REFERENCES contribution_types(id),
    due_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User contribution status table (tracks each user's payment status for each contribution request)
CREATE TABLE user_contribution_status (
    id BIGSERIAL PRIMARY KEY NOT NULL,
    user_id BIGSERIAL REFERENCES users(id) ON DELETE CASCADE,
    notification_id BIGSERIAL REFERENCES notifications(id) ON DELETE CASCADE,
    contribution_type_id BIGSERIAL REFERENCES contribution_types(id),
    required_amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0.00,
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overdue')),
    last_payment_id BIGSERIAL REFERENCES payments(id),
    last_paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, notification_id, contribution_type_id)
);

-- Notification reads table (tracks who has read what)
CREATE TABLE notification_reads (
    id BIGSERIAL PRIMARY KEY NOT NULL,
    notification_id BIGSERIAL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id BIGSERIAL REFERENCES users(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(notification_id, user_id)
);

-- Audit logs table
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY NOT NULL,
    user_id BIGSERIAL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    target_id BIGINT NULL,  -- Changed from BIGSERIAL to BIGINT NULL
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment activities table (for tracking payment-related activities)
CREATE TABLE payment_activities (
    id BIGSERIAL PRIMARY KEY NOT NULL,
    user_id BIGSERIAL REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_deleted ON users(is_deleted);
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);

CREATE INDEX idx_otps_user_id ON otps(user_id);
CREATE INDEX idx_otps_code ON otps(otp_code);
CREATE INDEX idx_otps_purpose ON otps(purpose);
CREATE INDEX idx_otps_expires ON otps(expires_at);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(payment_status);
CREATE INDEX idx_payments_created ON payments(created_at);
CREATE INDEX idx_payments_transaction ON payments(transaction_reference);

CREATE INDEX idx_notifications_sender ON notifications(sender_id);
CREATE INDEX idx_notifications_created ON notifications(created_at);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_notifications_contribution_type ON notifications(contribution_type_id);

CREATE INDEX idx_user_contribution_status_user ON user_contribution_status(user_id);
CREATE INDEX idx_user_contribution_status_notification ON user_contribution_status(notification_id);
CREATE INDEX idx_user_contribution_status_contribution_type ON user_contribution_status(contribution_type_id);
CREATE INDEX idx_user_contribution_status_payment_status ON user_contribution_status(payment_status);

CREATE INDEX idx_notification_reads_user ON notification_reads(user_id);
CREATE INDEX idx_notification_reads_notification ON notification_reads(notification_id);
CREATE INDEX idx_notification_reads_status ON notification_reads(is_read);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Functions and triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to tables that need it
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contribution_types_updated_at BEFORE UPDATE ON contribution_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_contribution_status_updated_at BEFORE UPDATE ON user_contribution_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default contribution types
INSERT INTO contribution_types (name, amount, description, created_by) VALUES
('Annual Membership Fee', 300000.00, 'Annual membership fee for active participation', NULL),
('Emergency Fund', 50000.00, 'Emergency fund for member assistance', NULL),
('Special Project Fund', 25000.00, 'Contribution for special union projects and initiatives', NULL);

-- Insert default admin user (password: Admin@123)
-- Note: In production, create this user through the API with a secure password
-- Default admin seeding via Firebase is recommended. Create an admin in Firebase Auth and then insert a user row with the firebase_uid if needed.

-- Create a view for user statistics
CREATE VIEW user_stats AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN role = 'member' THEN 1 END) as members,
    COUNT(CASE WHEN role LIKE 'admin%' THEN 1 END) as admins,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_users_30_days
FROM users 
WHERE is_deleted = false;

-- Create a view for payment statistics
CREATE VIEW payment_stats AS
SELECT 
    COUNT(*) as total_payments,
    SUM(CASE WHEN payment_status = 'success' THEN amount_paid ELSE 0 END) as total_successful_amount,
    COUNT(CASE WHEN payment_status = 'success' THEN 1 END) as successful_payments,
    COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_payments,
    COUNT(CASE WHEN payment_status = 'failed' THEN 1 END) as failed_payments,
    AVG(CASE WHEN payment_status = 'success' THEN amount_paid END) as average_payment_amount
FROM payments;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mredeo_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mredeo_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO mredeo_user;

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts and profiles';
COMMENT ON TABLE user_settings IS 'User preferences and settings';
COMMENT ON TABLE otps IS 'One-time passwords for verification';
COMMENT ON TABLE contribution_types IS 'Types of contributions/payments';
COMMENT ON TABLE payments IS 'Payment transactions from members';
COMMENT ON TABLE issued_payments IS 'Payments issued by admins to members';
COMMENT ON TABLE notifications IS 'System notifications and contribution requests';
COMMENT ON TABLE notification_reads IS 'Tracking notification read status';
COMMENT ON TABLE user_contribution_status IS 'Tracks individual user payment status for each contribution request';
COMMENT ON TABLE audit_logs IS 'System activity audit trail';

COMMENT ON COLUMN users.role IS 'User role: member, admin_chairperson, admin_secretary, admin_signatory';
COMMENT ON COLUMN users.is_active IS 'Whether user account is active';
COMMENT ON COLUMN users.is_deleted IS 'Soft delete flag';
COMMENT ON COLUMN payments.payment_status IS 'Payment status: pending, success, failed, cancelled';
COMMENT ON COLUMN otps.purpose IS 'OTP purpose: signup, login, reset_password';

-- Sample data for testing (remove in production)
-- INSERT INTO users (full_name, username, email, phone_number, password_hash, is_active) VALUES
-- ('John Doe', 'johndoe', 'john@example.com', '+255700000001', '$2b$12$sample_hash', true),
-- ('Jane Smith', 'janesmith', 'jane@example.com', '+255700000002', '$2b$12$sample_hash', true);

-- End of schema
