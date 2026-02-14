import React, { useState, useEffect } from 'react';
import { ELEMENTAL_PALETTE, TYPOGRAPHY, SPACING } from '../theme/Theme';
import { UISystem } from '../../game/systems/UISystem';

interface SettingsState {
    soundEnabled: boolean;
    musicVolume: number;
    effectsVolume: number;
    hapticFeedback: boolean;
    particleQuality: 'low' | 'medium' | 'high';
    showTutorial: boolean;
    language: 'en' | 'vi';
    theme: 'dark' | 'auto';
}

// Extract components outside render
const VolumeSlider: React.FC<{ 
    label: string; 
    value: number; 
    onChange: (value: number) => void; 
    icon: string;
}> = ({ label, value, onChange, icon }) => (
    <div style={{ marginBottom: SPACING.md }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                <span>{icon}</span>
                <span>{label}</span>
            </span>
            <span style={{ color: ELEMENTAL_PALETTE.UI.primary, fontFamily: TYPOGRAPHY.fontFamily }}>
                {value}%
            </span>
        </div>
        <input
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            style={{
                width: '100%',
                height: '6px',
                background: '#333',
                borderRadius: '3px',
                outline: 'none',
                WebkitAppearance: 'none'
            }}
            aria-label={`${label} volume`}
        />
    </div>
);

const ToggleSetting: React.FC<{ 
    label: string; 
    value: boolean; 
    onChange: (value: boolean) => void; 
    icon: string;
    description?: string;
}> = ({ label, value, onChange, icon, description }) => (
    <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.sm,
        background: 'rgba(0,0,0,0.3)',
        borderRadius: '8px',
        marginBottom: SPACING.sm
    }}>
        <div>
            <span style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                <span>{icon}</span>
                <span>{label}</span>
            </span>
            {description && (
                <div style={{ fontSize: TYPOGRAPHY.caption, color: ELEMENTAL_PALETTE.UI.textSecondary, marginTop: '2px' }}>
                    {description}
                </div>
            )}
        </div>
        <button
            onClick={() => onChange(!value)}
            style={{
                width: '50px',
                height: '26px',
                background: value ? ELEMENTAL_PALETTE.UI.primary : '#333',
                border: 'none',
                borderRadius: '13px',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.3s'
            }}
            aria-label={`Toggle ${label}`}
        >
            <div style={{
                width: '22px',
                height: '22px',
                background: '#FFF',
                borderRadius: '50%',
                position: 'absolute',
                top: '2px',
                left: value ? '26px' : '2px',
                transition: 'left 0.3s'
            }} />
        </button>
    </div>
);

export const SettingsScreen: React.FC = () => {
    const [settings, setSettings] = useState<SettingsState>({
        soundEnabled: true,
        musicVolume: 70,
        effectsVolume: 80,
        hapticFeedback: true,
        particleQuality: 'high',
        showTutorial: false,
        language: 'en',
        theme: 'dark'
    });

    useEffect(() => {
        const sys = UISystem.getInstance();
        const onUpdate = () => {
            // Update logic here if needed
        };
        sys.on('update', onUpdate);
        return () => { sys.off('update', onUpdate); }
    }, []);

    const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        // TODO: Save to localStorage/game state
        console.log(`Setting ${key} to ${value}`);
    };

    const resetSettings = () => {
        setSettings({
            soundEnabled: true,
            musicVolume: 70,
            effectsVolume: 80,
            hapticFeedback: true,
            particleQuality: 'high',
            showTutorial: false,
            language: 'en',
            theme: 'dark'
        });
    };

    return (
        <div style={{
            width: '100%',
            height: '100%',
            background: `linear-gradient(135deg, ${ELEMENTAL_PALETTE.UI.background}, ${ELEMENTAL_PALETTE.UI.surface})`,
            color: ELEMENTAL_PALETTE.UI.text,
            padding: SPACING.md,
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg }}>
                <button
                    onClick={() => UISystem.getInstance().switchScreen('MAIN_MENU')}
                    style={{
                        background: 'transparent',
                        border: `1px solid ${ELEMENTAL_PALETTE.UI.textSecondary}`,
                        color: ELEMENTAL_PALETTE.UI.textSecondary,
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontFamily: TYPOGRAPHY.fontFamily
                    }}
                >
                    ← BACK
                </button>
                
                <h2 style={{ 
                    fontFamily: TYPOGRAPHY.fontFamily, 
                    fontSize: TYPOGRAPHY.h2, 
                    color: ELEMENTAL_PALETTE.UI.primary,
                    textShadow: `0 0 10px ${ELEMENTAL_PALETTE.UI.primary}`
                }}>
                    SETTINGS
                </h2>
                
                <button
                    onClick={resetSettings}
                    style={{
                        background: 'transparent',
                        border: `1px solid ${ELEMENTAL_PALETTE.UI.error}`,
                        color: ELEMENTAL_PALETTE.UI.error,
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontFamily: TYPOGRAPHY.fontFamily,
                        fontSize: TYPOGRAPHY.caption
                    }}
                >
                    RESET
                </button>
            </div>

            {/* Settings Content */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: SPACING.lg }}>
                
                {/* Audio Settings */}
                <div style={{
                    background: 'rgba(0,0,0,0.6)',
                    border: `2px solid ${ELEMENTAL_PALETTE.UI.secondary}`,
                    borderRadius: '12px',
                    padding: SPACING.lg,
                    backdropFilter: 'blur(10px)'
                }}>
                    <h3 style={{ 
                        fontFamily: TYPOGRAPHY.fontFamily, 
                        fontSize: TYPOGRAPHY.h3, 
                        marginBottom: SPACING.md,
                        color: ELEMENTAL_PALETTE.UI.secondary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: SPACING.sm
                    }}>
                        🔊 AUDIO
                    </h3>
                    
                    <ToggleSetting
                        label="Sound Enabled"
                        value={settings.soundEnabled}
                        onChange={(value) => updateSetting('soundEnabled', value)}
                        icon="🔊"
                        description="Enable all game sounds"
                    />
                    
                    <VolumeSlider
                        label="Music Volume"
                        value={settings.musicVolume}
                        onChange={(value) => updateSetting('musicVolume', value)}
                        icon="🎵"
                    />
                    
                    <VolumeSlider
                        label="Effects Volume"
                        value={settings.effectsVolume}
                        onChange={(value) => updateSetting('effectsVolume', value)}
                        icon="💥"
                    />
                </div>

                {/* Gameplay Settings */}
                <div style={{
                    background: 'rgba(0,0,0,0.6)',
                    border: `2px solid ${ELEMENTAL_PALETTE.WATER.primary}`,
                    borderRadius: '12px',
                    padding: SPACING.lg,
                    backdropFilter: 'blur(10px)'
                }}>
                    <h3 style={{ 
                        fontFamily: TYPOGRAPHY.fontFamily, 
                        fontSize: TYPOGRAPHY.h3, 
                        marginBottom: SPACING.md,
                        color: ELEMENTAL_PALETTE.WATER.primary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: SPACING.sm
                    }}>
                        🎮 GAMEPLAY
                    </h3>
                    
                    <ToggleSetting
                        label="Haptic Feedback"
                        value={settings.hapticFeedback}
                        onChange={(value) => updateSetting('hapticFeedback', value)}
                        icon="📳"
                        description="Vibration on matches and actions"
                    />
                    
                    <div style={{ marginBottom: SPACING.md }}>
                        <div style={{ marginBottom: SPACING.sm, display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                            <span>✨</span>
                            <span>Particle Quality</span>
                        </div>
                        <div style={{ display: 'flex', gap: SPACING.sm }}>
                            {(['low', 'medium', 'high'] as const).map(quality => (
                                <button
                                    key={quality}
                                    onClick={() => updateSetting('particleQuality', quality)}
                                    style={{
                                        flex: 1,
                                        padding: '8px',
                                        background: settings.particleQuality === quality ? ELEMENTAL_PALETTE.WATER.primary : '#333',
                                        border: 'none',
                                        color: settings.particleQuality === quality ? '#FFF' : ELEMENTAL_PALETTE.UI.textSecondary,
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontFamily: TYPOGRAPHY.fontFamily,
                                        textTransform: 'capitalize'
                                    }}
                                >
                                    {quality}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <ToggleSetting
                        label="Show Tutorial"
                        value={settings.showTutorial}
                        onChange={(value) => updateSetting('showTutorial', value)}
                        icon="📚"
                        description="Display helpful hints during gameplay"
                    />
                </div>

                {/* System Settings */}
                <div style={{
                    background: 'rgba(0,0,0,0.6)',
                    border: `2px solid ${ELEMENTAL_PALETTE.EARTH.primary}`,
                    borderRadius: '12px',
                    padding: SPACING.lg,
                    backdropFilter: 'blur(10px)'
                }}>
                    <h3 style={{ 
                        fontFamily: TYPOGRAPHY.fontFamily, 
                        fontSize: TYPOGRAPHY.h3, 
                        marginBottom: SPACING.md,
                        color: ELEMENTAL_PALETTE.EARTH.primary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: SPACING.sm
                    }}>
                        ⚙️ SYSTEM
                    </h3>
                    
                    <div style={{ marginBottom: SPACING.md }}>
                        <div style={{ marginBottom: SPACING.sm, display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                            <span>🌐</span>
                            <span>Language</span>
                        </div>
                        <div style={{ display: 'flex', gap: SPACING.sm }}>
                            <button
                                onClick={() => updateSetting('language', 'en')}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    background: settings.language === 'en' ? ELEMENTAL_PALETTE.EARTH.primary : '#333',
                                    border: 'none',
                                    color: settings.language === 'en' ? '#FFF' : ELEMENTAL_PALETTE.UI.textSecondary,
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontFamily: TYPOGRAPHY.fontFamily
                                }}
                            >
                                English
                            </button>
                            <button
                                onClick={() => updateSetting('language', 'vi')}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    background: settings.language === 'vi' ? ELEMENTAL_PALETTE.EARTH.primary : '#333',
                                    border: 'none',
                                    color: settings.language === 'vi' ? '#FFF' : ELEMENTAL_PALETTE.UI.textSecondary,
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontFamily: TYPOGRAPHY.fontFamily
                                }}
                            >
                                Tiếng Việt
                            </button>
                        </div>
                    </div>
                    
                    <div style={{ marginBottom: SPACING.md }}>
                        <div style={{ marginBottom: SPACING.sm, display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                            <span>🎨</span>
                            <span>Theme</span>
                        </div>
                        <div style={{ display: 'flex', gap: SPACING.sm }}>
                            <button
                                onClick={() => updateSetting('theme', 'dark')}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    background: settings.theme === 'dark' ? ELEMENTAL_PALETTE.EARTH.primary : '#333',
                                    border: 'none',
                                    color: settings.theme === 'dark' ? '#FFF' : ELEMENTAL_PALETTE.UI.textSecondary,
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontFamily: TYPOGRAPHY.fontFamily
                                }}
                            >
                                Dark
                            </button>
                            <button
                                onClick={() => updateSetting('theme', 'auto')}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    background: settings.theme === 'auto' ? ELEMENTAL_PALETTE.EARTH.primary : '#333',
                                    border: 'none',
                                    color: settings.theme === 'auto' ? '#FFF' : ELEMENTAL_PALETTE.UI.textSecondary,
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontFamily: TYPOGRAPHY.fontFamily
                                }}
                            >
                                Auto
                            </button>
                        </div>
                    </div>
                </div>

                {/* About Section */}
                <div style={{
                    background: 'rgba(0,0,0,0.6)',
                    border: `2px solid ${ELEMENTAL_PALETTE.METAL.primary}`,
                    borderRadius: '12px',
                    padding: SPACING.lg,
                    backdropFilter: 'blur(10px)'
                }}>
                    <h3 style={{ 
                        fontFamily: TYPOGRAPHY.fontFamily, 
                        fontSize: TYPOGRAPHY.h3, 
                        marginBottom: SPACING.md,
                        color: ELEMENTAL_PALETTE.METAL.primary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: SPACING.sm
                    }}>
                        ℹ️ ABOUT
                    </h3>
                    
                    <div style={{ fontSize: TYPOGRAPHY.body, lineHeight: 1.6 }}>
                        <p style={{ margin: '0 0 SPACING.sm 0' }}>
                            <strong>Ngũ Hành Match-3</strong>
                        </p>
                        <p style={{ margin: '0 0 SPACING.sm 0', color: ELEMENTAL_PALETTE.UI.textSecondary }}>
                            Version: 1.0.0 (Beta)
                        </p>
                        <p style={{ margin: '0 0 SPACING.sm 0', color: ELEMENTAL_PALETTE.UI.textSecondary }}>
                            Built with React, PixiJS, and WebAssembly
                        </p>
                        <p style={{ margin: '0 0 SPACING.sm 0', color: ELEMENTAL_PALETTE.UI.textSecondary }}>
                            © 2026 LIVINGINK Studio
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
