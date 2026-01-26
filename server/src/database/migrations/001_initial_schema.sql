/**
 * PHASE 2: Database Schema Migration
 * PostgreSQL schema for enterprise-scale game data persistence
 */

-- EIDOLON-V PHASE2: Create database if not exists
-- CREATE DATABASE color_jelly_rush;

-- EIDOLON-V PHASE2: Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- EIDOLON-V PHASE2: Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    is_guest BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    
    -- EIDOLON-V PHASE2: Indexes for performance
    CONSTRAINT users_username_check CHECK (username ~ '^[a-zA-Z0-9_-]{3,50}$'),
    CONSTRAINT users_email_check CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL)
);

-- EIDOLON-V PHASE2: User statistics
CREATE TABLE IF NOT EXISTS user_stats (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    games_played INTEGER DEFAULT 0,
    total_score BIGINT DEFAULT 0,
    highest_score BIGINT DEFAULT 0,
    total_playtime_seconds INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    experience_points BIGINT DEFAULT 0,
    achievements JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- EIDOLON-V PHASE2: Game sessions
CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id VARCHAR(255) NOT NULL,
    host_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    game_mode VARCHAR(50) DEFAULT 'battle_royale',
    map_config JSONB DEFAULT '{}',
    max_players INTEGER DEFAULT 50,
    current_players INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished', 'abandoned')),
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- EIDOLON-V PHASE2: Session participants
CREATE TABLE IF NOT EXISTS session_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    final_score BIGINT DEFAULT 0,
    final_position INTEGER,
    final_level INTEGER DEFAULT 1,
    playtime_seconds INTEGER DEFAULT 0,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    pigment_collected JSONB DEFAULT '{}',
    tattoos_used JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    
    UNIQUE(session_id, user_id)
);

-- EIDOLON-V PHASE2: Leaderboard entries
CREATE TABLE IF NOT EXISTS leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    score BIGINT NOT NULL,
    game_mode VARCHAR(50) DEFAULT 'battle_royale',
    achieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_id UUID REFERENCES game_sessions(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'
);

-- EIDOLON-V PHASE2: User preferences and settings
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    graphics_quality VARCHAR(20) DEFAULT 'medium' CHECK (graphics_quality IN ('low', 'medium', 'high', 'ultra')),
    sound_enabled BOOLEAN DEFAULT true,
    music_enabled BOOLEAN DEFAULT true,
    colorblind_mode VARCHAR(20) DEFAULT 'off' CHECK (colorblind_mode IN ('off', 'protanopia', 'deuteranopia', 'tritanopia')),
    controls JSONB DEFAULT '{}',
    ui_preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- EIDOLON-V PHASE2: Analytics events
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES game_sessions(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    client_timestamp TIMESTAMP WITH TIME ZONE,
    server_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'
);

-- EIDOLON-V PHASE2: System metrics for monitoring
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_unit VARCHAR(20) DEFAULT 'count',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tags JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}'
);

-- EIDOLON-V PHASE2: Security events
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('login_success', 'login_failure', 'rate_limit', 'suspicious_activity', 'banned', 'password_change')),
    ip_address INET NOT NULL,
    user_agent TEXT,
    event_data JSONB DEFAULT '{}',
    severity VARCHAR(10) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- EIDOLON-V PHASE2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_total_score ON user_stats(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_level ON user_stats(level DESC);

CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON game_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_host_user_id ON game_sessions(host_user_id);

CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_user_id ON session_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_final_score ON session_participants(final_score DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_game_mode ON leaderboard(game_mode);
CREATE INDEX IF NOT EXISTS idx_leaderboard_achieved_at ON leaderboard(achieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_user_id ON leaderboard(user_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(server_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_system_metrics_name_timestamp ON system_metrics(metric_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_address ON security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);

-- EIDOLON-V PHASE2: Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON user_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_sessions_updated_at BEFORE UPDATE ON game_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- EIDOLON-V PHASE2: Insert default admin user
INSERT INTO users (username, email, password_hash, salt, is_active, is_guest)
VALUES (
    'admin',
    'admin@colorjellyrush.com',
    '$2b$10$rQZ8kHWKjGYMkQq3q3q3qO', -- This should be properly hashed
    'random_salt_here',
    true,
    false
) ON CONFLICT (username) DO NOTHING;

-- EIDOLON-V PHASE2: Create view for leaderboard aggregation
CREATE OR REPLACE VIEW leaderboard_view AS
SELECT 
    u.id as user_id,
    u.username,
    COALESCE(us.total_score, 0) as total_score,
    COALESCE(us.highest_score, 0) as highest_score,
    COALESCE(us.games_played, 0) as games_played,
    COALESCE(us.level, 1) as level,
    COALESCE(us.experience_points, 0) as experience_points,
    u.created_at as user_created_at,
    u.last_login
FROM users u
LEFT JOIN user_stats us ON u.id = us.user_id
WHERE u.is_active = true AND u.is_guest = false
ORDER BY total_score DESC, highest_score DESC;

-- EIDOLON-V PHASE2: Create view for active sessions
CREATE OR REPLACE VIEW active_sessions_view AS
SELECT 
    gs.id,
    gs.room_id,
    gs.status,
    gs.current_players,
    gs.max_players,
    gs.game_mode,
    gs.started_at,
    u.username as host_username,
    COUNT(sp.id) as participant_count
FROM game_sessions gs
LEFT JOIN users u ON gs.host_user_id = u.id
LEFT JOIN session_participants sp ON gs.id = sp.session_id
WHERE gs.status IN ('waiting', 'active')
GROUP BY gs.id, u.username
ORDER BY gs.created_at DESC;

-- EIDOLON-V PHASE2: Grant permissions (adjust as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cjr_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cjr_user;
