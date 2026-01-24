/**
 * PREMIUM MONETIZATION SYSTEM
 * Cosmetic IAPs, battle pass, retention mechanics
 */

export interface MonetizationConfig {
  currency: string;
  prices: Record<string, number>;
  battlePassPrice: number;
  premiumBattlePassPrice: number;
}

export interface CosmeticItem {
  id: string;
  name: string;
  type: 'skin' | 'trail' | 'aura' | 'badge' | 'effect';
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
  price: number;
  isPremium: boolean;
  isLimited: boolean;
  unlockCondition?: string;
  previewUrl?: string;
}

export interface BattlePassTier {
  level: number;
  rewards: {
    free: CosmeticItem[];
    premium: CosmeticItem[];
  };
  requiredXP: number;
}

export interface PlayerInventory {
  ownedCosmetics: string[];
  equippedCosmetics: {
    skin?: string;
    trail?: string;
    aura?: string;
    badge?: string;
    effect?: string;
  };
  currency: number;
  premiumCurrency: number;
  battlePassLevel: number;
  battlePassXP: number;
  hasPremiumPass: boolean;
  dailyStreak: number;
  lastDailyClaim: number;
}

export interface RetentionMechanic {
  type: 'dailyBonus' | 'streakBonus' | 'achievement' | 'seasonalEvent';
  reward: {
    type: 'currency' | 'cosmetic' | 'xp' | 'battlePassXP' | 'premiumCurrency';
    amount: number;
    itemId?: string;
  };
  condition: string;
  isClaimed: boolean;
}

export class MonetizationSystem {
  private config: MonetizationConfig;
  private cosmetics: CosmeticItem[] = [];
  private battlePassTiers: BattlePassTier[] = [];
  private playerInventory: PlayerInventory;
  private retentionMechanics: RetentionMechanic[] = [];
  private isInitialized = false;

  constructor() {
    this.config = {
      currency: 'USD',
      prices: {
        'small_gems': 4.99,
        'medium_gems': 9.99,
        'large_gems': 19.99,
        'mega_gems': 49.99,
      },
      battlePassPrice: 9.99,
      premiumBattlePassPrice: 19.99,
    };

    this.playerInventory = this.getDefaultInventory();
    this.initializeCosmetics();
    this.initializeBattlePass();
    this.initializeRetentionMechanics();
    this.isInitialized = true;
  }

  private getDefaultInventory(): PlayerInventory {
    return {
      ownedCosmetics: ['default_skin', 'default_trail'],
      equippedCosmetics: {
        skin: 'default_skin',
        trail: 'default_trail',
      },
      currency: 100,
      premiumCurrency: 0,
      battlePassLevel: 1,
      battlePassXP: 0,
      hasPremiumPass: false,
      dailyStreak: 0,
      lastDailyClaim: 0,
    };
  }

  private initializeCosmetics() {
    this.cosmetics = [
      // Skins
      { id: 'neon_jelly', name: 'Neon Jelly', type: 'skin', rarity: 'rare', price: 500, isPremium: false, isLimited: false },
      { id: 'golden_jelly', name: 'Golden Jelly', type: 'skin', rarity: 'epic', price: 1500, isPremium: false, isLimited: false },
      { id: 'shadow_jelly', name: 'Shadow Jelly', type: 'skin', rarity: 'legendary', price: 3000, isPremium: true, isLimited: false },
      { id: 'cosmic_jelly', name: 'Cosmic Jelly', type: 'skin', rarity: 'mythic', price: 5000, isPremium: true, isLimited: true },
      
      // Trails
      { id: 'rainbow_trail', name: 'Rainbow Trail', type: 'trail', rarity: 'rare', price: 400, isPremium: false, isLimited: false },
      { id: 'fire_trail', name: 'Fire Trail', type: 'trail', rarity: 'epic', price: 1200, isPremium: false, isLimited: false },
      { id: 'galaxy_trail', name: 'Galaxy Trail', type: 'trail', rarity: 'legendary', price: 2500, isPremium: true, isLimited: false },
      
      // Auras
      { id: 'speed_aura', name: 'Speed Aura', type: 'aura', rarity: 'common', price: 200, isPremium: false, isLimited: false },
      { id: 'power_aura', name: 'Power Aura', type: 'aura', rarity: 'rare', price: 600, isPremium: false, isLimited: false },
      { id: 'divine_aura', name: 'Divine Aura', type: 'aura', rarity: 'epic', price: 1800, isPremium: true, isLimited: false },
      
      // Badges
      { id: 'veteran_badge', name: 'Veteran', type: 'badge', rarity: 'rare', price: 800, isPremium: false, isLimited: false },
      { id: 'champion_badge', name: 'Champion', type: 'badge', rarity: 'epic', price: 2000, isPremium: true, isLimited: false },
      { id: 'legend_badge', name: 'Legend', type: 'badge', rarity: 'legendary', price: 4000, isPremium: true, isLimited: true },
      
      // Effects
      { id: 'explosion_effect', name: 'Explosion Effect', type: 'effect', rarity: 'rare', price: 700, isPremium: false, isLimited: false },
      { id: 'teleport_effect', name: 'Teleport Effect', type: 'effect', rarity: 'epic', price: 1500, isPremium: true, isLimited: false },
      { id: 'time_effect', name: 'Time Effect', type: 'effect', rarity: 'legendary', price: 3500, isPremium: true, isLimited: true },
    ];
  }

  private initializeBattlePass() {
    this.battlePassTiers = Array.from({ length: 100 }, (_, i) => ({
      level: i + 1,
      requiredXP: (i + 1) * 1000,
      rewards: {
        free: this.getFreeRewards(i + 1),
        premium: this.getPremiumRewards(i + 1),
      },
    }));
  }

  private getFreeRewards(level: number): CosmeticItem[] {
    const rewards: CosmeticItem[] = [];
    
    // Currency rewards every 5 levels
    if (level % 5 === 0) {
      rewards.push({
        id: `currency_${level}`,
        name: `${level * 100} Coins`,
        type: 'skin',
        rarity: 'common',
        price: 0,
        isPremium: false,
        isLimited: false,
      });
    }
    
    // Cosmetic rewards every 10 levels
    if (level % 10 === 0) {
      const cosmetic = this.cosmetics.find(c => c.rarity === 'rare' && !c.isPremium);
      if (cosmetic) rewards.push(cosmetic);
    }
    
    return rewards;
  }

  private getPremiumRewards(level: number): CosmeticItem[] {
    const rewards: CosmeticItem[] = [];
    
    // Premium currency every 5 levels
    if (level % 5 === 0) {
      rewards.push({
        id: `premium_currency_${level}`,
        name: `${level * 50} Gems`,
        type: 'skin',
        rarity: 'rare',
        price: 0,
        isPremium: true,
        isLimited: false,
      });
    }
    
    // Premium cosmetics every 5 levels
    if (level % 5 === 0) {
      const cosmetic = this.cosmetics.find(c => c.isPremium && c.rarity === 'epic');
      if (cosmetic) rewards.push(cosmetic);
    }
    
    return rewards;
  }

  private initializeRetentionMechanics() {
    this.retentionMechanics = [
      {
        type: 'dailyBonus',
        reward: { type: 'currency', amount: 100 },
        condition: 'login_daily',
        isClaimed: false,
      },
      {
        type: 'streakBonus',
        reward: { type: 'premiumCurrency', amount: 10 },
        condition: 'login_streak_7',
        isClaimed: false,
      },
      {
        type: 'achievement',
        reward: { type: 'cosmetic', amount: 1, itemId: 'veteran_badge' },
        condition: 'play_100_games',
        isClaimed: false,
      },
      {
        type: 'seasonalEvent',
        reward: { type: 'battlePassXP', amount: 5000 },
        condition: 'seasonal_event_complete',
        isClaimed: false,
      },
    ];
  }

  // Purchase system
  purchaseCurrency(packageId: string): boolean {
    const price = this.config.prices[packageId];
    if (!price) return false;

    // In a real implementation, this would integrate with app store payment APIs
    const currencyAmounts: Record<string, number> = {
      'small_gems': 100,
      'medium_gems': 250,
      'large_gems': 600,
      'mega_gems': 1500,
    };

    this.playerInventory.premiumCurrency += currencyAmounts[packageId] || 0;
    console.log(`💎 Purchased ${packageId} for $${price}`);
    return true;
  }

  purchaseCosmetic(itemId: string): boolean {
    const cosmetic = this.cosmetics.find(c => c.id === itemId);
    if (!cosmetic || this.playerInventory.ownedCosmetics.includes(itemId)) return false;

    const cost = cosmetic.isPremium ? cosmetic.price / 10 : cosmetic.price; // Premium items cost premium currency
    const currency = cosmetic.isPremium ? this.playerInventory.premiumCurrency : this.playerInventory.currency;

    if (currency < cost) return false;

    if (cosmetic.isPremium) {
      this.playerInventory.premiumCurrency -= cost;
    } else {
      this.playerInventory.currency -= cost;
    }

    this.playerInventory.ownedCosmetics.push(itemId);
    console.log(`🎨 Purchased ${cosmetic.name}`);
    return true;
  }

  purchaseBattlePass(premium: boolean = false): boolean {
    const price = premium ? this.config.premiumBattlePassPrice : this.config.battlePassPrice;
    
    // In a real implementation, this would integrate with payment APIs
    this.playerInventory.hasPremiumPass = premium;
    console.log(`🎯 Purchased ${premium ? 'Premium' : 'Standard'} Battle Pass for $${price}`);
    return true;
  }

  // Battle pass system
  addBattlePassXP(amount: number) {
    this.playerInventory.battlePassXP += amount;
    
    // Check for level up
    while (this.playerInventory.battlePassXP >= this.getCurrentTierRequiredXP()) {
      this.playerInventory.battlePassXP -= this.getCurrentTierRequiredXP();
      this.playerInventory.battlePassLevel++;
      this.claimBattlePassRewards();
    }
  }

  private getCurrentTierRequiredXP(): number {
    const tier = this.battlePassTiers.find(t => t.level === this.playerInventory.battlePassLevel);
    return tier?.requiredXP || 1000;
  }

  private claimBattlePassRewards() {
    const tier = this.battlePassTiers.find(t => t.level === this.playerInventory.battlePassLevel);
    if (!tier) return;

    // Claim free rewards
    tier.rewards.free.forEach(reward => {
      if (reward.id.startsWith('currency_')) {
        this.playerInventory.currency += parseInt(reward.name);
      } else {
        this.playerInventory.ownedCosmetics.push(reward.id);
      }
    });

    // Claim premium rewards if has premium pass
    if (this.playerInventory.hasPremiumPass) {
      tier.rewards.premium.forEach(reward => {
        if (reward.id.startsWith('premium_currency_')) {
          this.playerInventory.premiumCurrency += parseInt(reward.name);
        } else {
          this.playerInventory.ownedCosmetics.push(reward.id);
        }
      });
    }

    console.log(`🎯 Battle Pass Level ${this.playerInventory.battlePassLevel} rewards claimed!`);
  }

  // Retention mechanics
  claimDailyBonus(): boolean {
    const now = Date.now();
    const lastClaim = this.playerInventory.lastDailyClaim;
    const daysSinceLastClaim = Math.floor((now - lastClaim) / (1000 * 60 * 60 * 24));

    if (daysSinceLastClaim >= 1) {
      // Reset streak if missed more than 1 day
      if (daysSinceLastClaim > 1) {
        this.playerInventory.dailyStreak = 1;
      } else {
        this.playerInventory.dailyStreak++;
      }

      const bonus = 100 * (1 + this.playerInventory.dailyStreak * 0.1);
      this.playerInventory.currency += Math.floor(bonus);
      this.playerInventory.lastDailyClaim = now;

      console.log(`🎁 Daily bonus claimed: ${Math.floor(bonus)} coins (Streak: ${this.playerInventory.dailyStreak})`);
      return true;
    }

    return false;
  }

  // Cosmetic management
  equipCosmetic(itemId: string, slot: keyof PlayerInventory['equippedCosmetics']): boolean {
    if (!this.playerInventory.ownedCosmetics.includes(itemId)) return false;
    
    const cosmetic = this.cosmetics.find(c => c.id === itemId);
    if (!cosmetic || cosmetic.type !== slot) return false;

    this.playerInventory.equippedCosmetics[slot] = itemId;
    console.log(`🎨 Equipped ${cosmetic.name} in ${slot} slot`);
    return true;
  }

  // Analytics and tracking
  getPlayerStats() {
    return {
      totalCosmeticsOwned: this.playerInventory.ownedCosmetics.length,
      totalCosmeticsAvailable: this.cosmetics.length,
      battlePassProgress: {
        level: this.playerInventory.battlePassLevel,
        xp: this.playerInventory.battlePassXP,
        hasPremium: this.playerInventory.hasPremiumPass,
      },
      currency: {
        regular: this.playerInventory.currency,
        premium: this.playerInventory.premiumCurrency,
      },
      retention: {
        dailyStreak: this.playerInventory.dailyStreak,
        lastDailyClaim: this.playerInventory.lastDailyClaim,
      },
    };
  }

  // Shop interface
  getShopItems() {
    return {
      cosmetics: this.cosmetics.filter(c => !c.isLimited || this.isLimitedTimeAvailable(c)),
      currencyPackages: Object.entries(this.config.prices).map(([id, price]) => ({
        id,
        price,
        currency: 'USD',
        gems: id.includes('gems'),
      })),
      battlePass: {
        standard: { price: this.config.battlePassPrice, currency: 'USD' },
        premium: { price: this.config.premiumBattlePassPrice, currency: 'USD' },
      },
    };
  }

  private isLimitedTimeAvailable(cosmetic: CosmeticItem): boolean {
    // In a real implementation, this would check against server time
    return true; // Simplified for demo
  }

  // Save/Load system
  saveInventory() {
    localStorage.setItem('cjr_inventory', JSON.stringify(this.playerInventory));
  }

  loadInventory() {
    const saved = localStorage.getItem('cjr_inventory');
    if (saved) {
      this.playerInventory = { ...this.getDefaultInventory(), ...JSON.parse(saved) };
    }
  }

  // Validation
  validatePurchase(itemId: string): { canPurchase: boolean; reason?: string } {
    const cosmetic = this.cosmetics.find(c => c.id === itemId);
    if (!cosmetic) return { canPurchase: false, reason: 'Item not found' };
    if (this.playerInventory.ownedCosmetics.includes(itemId)) {
      return { canPurchase: false, reason: 'Already owned' };
    }

    const cost = cosmetic.isPremium ? cosmetic.price / 10 : cosmetic.price;
    const currency = cosmetic.isPremium ? this.playerInventory.premiumCurrency : this.playerInventory.currency;

    if (currency < cost) {
      return { canPurchase: false, reason: 'Insufficient currency' };
    }

    return { canPurchase: true };
  }
}

export const monetizationSystem = new MonetizationSystem();
