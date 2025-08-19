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
    role VARCHAR(30) DEFAULT 'member' CHECK (role IN ('member', 'admin_chairperson', 'admin_secretary', 'admin_signatory', 'admin_treasurer')),
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

-- Issued payments table (admin payments to members with dual authorization)
CREATE TABLE issued_payments (
    id BIGSERIAL PRIMARY KEY NOT NULL,
    issued_by BIGSERIAL REFERENCES users(id), -- Legacy field, kept for backward compatibility
    issued_to BIGSERIAL REFERENCES users(id),
    amount DECIMAL(15,2) NOT NULL,
    purpose TEXT NOT NULL,
    transaction_reference VARCHAR(100) UNIQUE NOT NULL,
    
    -- Dual Authorization Fields
    initiated_by BIGSERIAL REFERENCES users(id), -- Financial authority who initiated (chairperson, secretary, or treasurer)
    approved_by BIGSERIAL REFERENCES users(id), -- Signatory who approved the payment
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    
    -- Payment Provider Integration Fields
    payment_provider_reference VARCHAR(100), -- Reference ID from payment provider (Vodacom, Tigo, Airtel, etc.)
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'provider_failed')),
    provider_error TEXT, -- Error message from payment provider if payment failed
    
    -- Workflow Enhancement Fields
    contribution_type VARCHAR(100),
    beneficiary_details JSONB,
    is_emergency_fund BOOLEAN DEFAULT false,
    
    -- Timestamps
    issued_at TIMESTAMP, -- When payment was actually sent to provider
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY NOT NULL,
    sender_id BIGSERIAL REFERENCES users(id),
    title VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(20) DEFAULT 'general' CHECK (notification_type IN ('general', 'contribution_request', 'payment_reminder', 'emergency_contribution')),
    contribution_type_id BIGSERIAL REFERENCES contribution_types(id),
    due_date DATE,
    is_active BOOLEAN DEFAULT true,
    beneficiary_user_id BIGSERIAL REFERENCES users(id) ON DELETE SET NULL,
    emergency_details JSONB,
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

-- Pending actions table (for admin dashboard workflow)
CREATE TABLE pending_actions (
    id BIGSERIAL PRIMARY KEY NOT NULL,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('payment_due', 'approval_needed', 'emergency_contribution', 'overdue_payment')),
    related_notification_id BIGSERIAL REFERENCES notifications(id) ON DELETE CASCADE,
    beneficiary_user_id BIGSERIAL REFERENCES users(id) ON DELETE CASCADE,
    due_date DATE,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional context fields
    contribution_type VARCHAR(100),
    expected_amount DECIMAL(15,2),
    description TEXT
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
CREATE INDEX idx_notifications_beneficiary_user_id ON notifications(beneficiary_user_id);
CREATE INDEX idx_notifications_due_date ON notifications(due_date);

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

-- Indexes for pending_actions table
CREATE INDEX idx_pending_actions_action_type ON pending_actions(action_type);
CREATE INDEX idx_pending_actions_is_resolved ON pending_actions(is_resolved);
CREATE INDEX idx_pending_actions_priority ON pending_actions(priority);
CREATE INDEX idx_pending_actions_due_date ON pending_actions(due_date);
CREATE INDEX idx_pending_actions_beneficiary ON pending_actions(beneficiary_user_id);
CREATE INDEX idx_pending_actions_notification ON pending_actions(related_notification_id);
CREATE INDEX idx_pending_actions_created_at ON pending_actions(created_at);
CREATE INDEX idx_pending_actions_status_priority ON pending_actions(is_resolved, priority, due_date);

-- Indexes for enhanced issued_payments fields
CREATE INDEX idx_issued_payments_contribution_type ON issued_payments(contribution_type);
CREATE INDEX idx_issued_payments_is_emergency_fund ON issued_payments(is_emergency_fund);
CREATE INDEX idx_issued_payments_updated_at ON issued_payments(updated_at);

-- Functions and triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS '
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
' language 'plpgsql';

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

CREATE TRIGGER update_issued_payments_updated_at BEFORE UPDATE ON issued_payments
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

-- View for admin dashboard pending actions with user details
CREATE VIEW admin_pending_actions AS
SELECT 
    pa.*,
    u.full_name as beneficiary_name,
    u.phone_number as beneficiary_phone,
    u.email as beneficiary_email,
    n.title as notification_title,
    n.due_date as notification_due_date,
    ct.name as contribution_type_name,
    ct.amount as contribution_amount,
    CASE 
        WHEN pa.due_date < CURRENT_DATE AND NOT pa.is_resolved THEN 'overdue'
        WHEN pa.due_date <= CURRENT_DATE + INTERVAL '3 days' AND NOT pa.is_resolved THEN 'due_soon'
        WHEN pa.is_resolved THEN 'resolved'
        ELSE 'pending'
    END as status_category
FROM pending_actions pa
LEFT JOIN users u ON pa.beneficiary_user_id = u.id
LEFT JOIN notifications n ON pa.related_notification_id = n.id
LEFT JOIN contribution_types ct ON ct.name = pa.contribution_type;

-- View for member contribution dashboard
CREATE VIEW member_contribution_dashboard AS
SELECT 
    ucs.*,
    u.full_name as member_name,
    ct.name as contribution_type_name,
    ct.amount as contribution_type_amount,
    n.title as notification_title,
    n.message as notification_message,
    n.due_date,
    n.notification_type,
    CASE 
        WHEN n.due_date < CURRENT_DATE AND ucs.payment_status != 'paid' THEN 'overdue'
        WHEN n.due_date <= CURRENT_DATE + INTERVAL '3 days' AND ucs.payment_status != 'paid' THEN 'due_soon'
        ELSE ucs.payment_status
    END as status_with_urgency
FROM user_contribution_status ucs
JOIN users u ON ucs.user_id = u.id
JOIN notifications n ON ucs.notification_id = n.id
JOIN contribution_types ct ON ucs.contribution_type_id = ct.id
WHERE n.is_active = true;

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
COMMENT ON TABLE pending_actions IS 'Tracks pending actions for admin dashboard - payments due, approvals needed, etc.';

COMMENT ON COLUMN users.role IS 'User role: member, admin_chairperson, admin_secretary, admin_signatory, admin_treasurer';
COMMENT ON COLUMN users.is_active IS 'Whether user account is active';
COMMENT ON COLUMN users.is_deleted IS 'Soft delete flag';
COMMENT ON COLUMN payments.payment_status IS 'Payment status: pending, success, failed, cancelled';
COMMENT ON COLUMN otps.purpose IS 'OTP purpose: signup, login, reset_password';

-- Workflow Enhancement Comments
COMMENT ON COLUMN notifications.beneficiary_user_id IS 'User ID of the beneficiary for emergency contributions';
COMMENT ON COLUMN notifications.emergency_details IS 'JSON details for emergency contributions (reason, medical info, etc.)';
COMMENT ON COLUMN issued_payments.contribution_type IS 'Type of contribution this payment relates to';
COMMENT ON COLUMN issued_payments.beneficiary_details IS 'JSON details about the beneficiary and payment context';
COMMENT ON COLUMN issued_payments.is_emergency_fund IS 'Whether this is an emergency fund payment';
COMMENT ON COLUMN pending_actions.action_type IS 'Type of pending action: payment_due, approval_needed, emergency_contribution';
COMMENT ON COLUMN pending_actions.priority IS 'Priority level: high, normal, low';
COMMENT ON COLUMN pending_actions.is_resolved IS 'Whether the pending action has been resolved';

-- Dual Authorization and Payment Provider Comments
COMMENT ON COLUMN issued_payments.initiated_by IS 'User who initiated the payment (chairperson, secretary, or treasurer)';
COMMENT ON COLUMN issued_payments.approved_by IS 'User who approved the payment (signatory)';
COMMENT ON COLUMN issued_payments.approval_status IS 'Current approval status of the payment';
COMMENT ON COLUMN issued_payments.approved_at IS 'Timestamp when payment was approved';
COMMENT ON COLUMN issued_payments.rejection_reason IS 'Reason for payment rejection if applicable';
COMMENT ON COLUMN issued_payments.payment_provider_reference IS 'Reference ID from payment provider (Vodacom, Tigo, Airtel, etc.)';
COMMENT ON COLUMN issued_payments.payment_status IS 'Status of actual payment processing with provider';
COMMENT ON COLUMN issued_payments.provider_error IS 'Error message from payment provider if payment failed';

-- End of schema
