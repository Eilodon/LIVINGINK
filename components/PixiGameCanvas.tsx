import React, { useEffect, useRef } from 'react';
import type { AnimatedSprite, Application, Container, Graphics, ParticleContainer, Sprite, Text, Texture, Ticker } from 'pixi.js';
import { Bot, Faction, GameState, Player, SizeTier } from '../types';
import { CENTER_RADIUS, COLOR_PALETTE, DANGER_THRESHOLD_RATIO, EAT_THRESHOLD_RATIO, ELEMENTAL_ADVANTAGE, FACTION_CONFIG, MAP_RADIUS, WORLD_HEIGHT, WORLD_WIDTH } from '../constants';
import { getSettings, subscribeSettings, type GameSettings, type QualityMode } from '../services/settings';
import { setRuntimeStats } from '../services/runtimeStats';

type PixiModule = typeof import('pixi.js');

const BASE_RADIUS = 28;
const BASE_SIZE = 224;
const BASE_CENTER = BASE_SIZE / 2;
const ENTITY_IDLE_FRAMES = [0, 8, 16, 24];
const ENTITY_MOVE_FRAMES = [0, 4, 8, 12];
const SPAWN_DURATION = 0.7;
const VIEW_BUFFER = 120;
const ITEM_TEXTURE_SIZE = 64;
const SOFT_TEXTURE_SIZE = 128;

type SpriteState = 'idle' | 'move';

type EntityTextureSet = {
  idle: Texture[];
  move: Texture[];
};

type TexturePack = {
  entityTextures: Map<string, EntityTextureSet>;
  mapTexture: Texture;
  abyssTexture: Texture;
  abyssRingTexture: Texture;
  softCircleTexture: Texture;
  solidCircleTexture: Texture;
  crownTexture: Texture;
};

type EntityVisual = {
  container: Container;
  sprite: AnimatedSprite;
  glow: Sprite;
  poison: Sprite;
  damage: Sprite;
  shield: Graphics;
  tier: SizeTier;
  state: SpriteState;
};

type ItemVisual = {
  container: Container;
  base: Sprite;
  highlight?: Sprite;
  glow?: Sprite;
  ring?: Graphics;
  kind?: string;
};

type ProjectileVisual = {
  container: Container;
  base: Sprite;
  glow: Sprite;
};

type LandmarkVisual = {
  container: Container;
  ring: Graphics;
  label: Text;
};

type DeathBurst = {
  container: Container;
  particles: Array<{ sprite: Sprite; velocity: { x: number; y: number } }>;
  life: number;
  maxLife: number;
};

type LayerPack = {
  world: Container;
  background: Container;
  lava: Graphics;
  zone: Graphics;
  hazards: Graphics;
  landmarks: Container;
  food: Container;
  powerUps: Container;
  trails: Graphics;
  projectiles: Container;
  entities: Container;
  rings: Graphics;
  labels: Container;
  particles: ParticleContainer;
  particleLines: Graphics;
  floatingTexts: Container;
  death: Container;
  screenOverlay: Graphics;
  abyssRing: Sprite;
};

const hexToNumber = (input: string, fallback: number = 0xffffff) => {
  const trimmed = input.trim();
  if (!trimmed) return fallback;

  const hexMatch = trimmed.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const raw = hexMatch[1];
    const expanded = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    const parsed = Number.parseInt(expanded, 16);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  const oxMatch = trimmed.match(/^0x([0-9a-f]{6})$/i);
  if (oxMatch) {
    const parsed = Number.parseInt(oxMatch[1], 16);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
};

const parsePixiColor = (value: string): { tint: number; alpha: number } => {
  const trimmed = value.trim();
  if (trimmed.startsWith('#')) {
    return { tint: hexToNumber(trimmed), alpha: 1 };
  }

  const rgbaMatch = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([0-9]*\.?[0-9]+)\s*)?\)$/i
  );
  if (rgbaMatch) {
    const r = Math.max(0, Math.min(255, Number(rgbaMatch[1])));
    const g = Math.max(0, Math.min(255, Number(rgbaMatch[2])));
    const b = Math.max(0, Math.min(255, Number(rgbaMatch[3])));
    const alphaRaw = rgbaMatch[4];
    const alpha = alphaRaw == null ? 1 : Math.max(0, Math.min(1, Number(alphaRaw)));
    const tint = (r << 16) | (g << 8) | b;
    return { tint, alpha };
  }

  // Fallback: avoid crashing render loop on unexpected strings
  return { tint: 0xffffff, alpha: 1 };
};

const distSq = (v1: { x: number; y: number }, v2: { x: number; y: number }) => {
  const dx = v1.x - v2.x;
  const dy = v1.y - v2.y;
  return dx * dx + dy * dy;
};

const getEntityKey = (faction: Faction, tier: SizeTier) => `${faction}-${tier}`;

const tintChannel = (value: number, delta: number) => Math.max(0, Math.min(255, value + delta));

const hexToRgb = (hex: string) => {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return { r, g, b };
};

const OUTLINE_COLOR = '#0f172a';

const shadeColor = (hex: string, delta: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${tintChannel(r, delta)}, ${tintChannel(g, delta)}, ${tintChannel(b, delta)})`;
};

const drawEllipseFillStroke = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  outline: string,
  lineWidth: number
) => {
  ctx.fillStyle = fill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
};

const drawStickerShadow = (ctx: CanvasRenderingContext2D, r: number) => {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(0, r * 1.12, r * 0.95, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawStickerHighlight = (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) => {
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawKawaiiFace = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  const eyeOffsetX = r * 0.35;
  const eyeOffsetY = r * 0.08;
  const eyeR = r * 0.18;

  ctx.fillStyle = OUTLINE_COLOR;
  ctx.beginPath();
  ctx.arc(x - eyeOffsetX, y - eyeOffsetY, eyeR, 0, Math.PI * 2);
  ctx.arc(x + eyeOffsetX, y - eyeOffsetY, eyeR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x - eyeOffsetX + eyeR * 0.35, y - eyeOffsetY - eyeR * 0.35, eyeR * 0.35, 0, Math.PI * 2);
  ctx.arc(x + eyeOffsetX + eyeR * 0.35, y - eyeOffsetY - eyeR * 0.35, eyeR * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = Math.max(2, r * 0.14);
  ctx.beginPath();
  ctx.arc(x, y + r * 0.22, r * 0.18, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#fb7185';
  ctx.beginPath();
  ctx.arc(x - eyeOffsetX * 1.35, y + r * 0.25, r * 0.16, 0, Math.PI * 2);
  ctx.arc(x + eyeOffsetX * 1.35, y + r * 0.25, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawKawaiiBee = (ctx: CanvasRenderingContext2D, tierLevel: number, frameCount: number) => {
  const r = BASE_RADIUS;
  const body = FACTION_CONFIG[Faction.Metal].color;
  const wingColor = '#cfefff';
  const stripeColor = '#1f2937';
  const outline = OUTLINE_COLOR;
  const outlineWidth = Math.max(4, r * 0.22);
  const wingScale = 0.6 + tierLevel * 0.1;
  const flap = Math.sin(frameCount * 0.28) * 0.35;

  ctx.save();
  ctx.translate(-r * 0.2, -r * 0.65);
  ctx.rotate(-0.5 + flap);
  drawEllipseFillStroke(ctx, 0, 0, r * 0.75 * wingScale, r * 0.42 * wingScale, wingColor, outline, outlineWidth * 0.6);
  ctx.restore();

  ctx.save();
  ctx.translate(r * 0.15, -r * 0.65);
  ctx.rotate(0.5 - flap);
  drawEllipseFillStroke(ctx, 0, 0, r * 0.75 * wingScale, r * 0.42 * wingScale, wingColor, outline, outlineWidth * 0.6);
  ctx.restore();

  drawEllipseFillStroke(ctx, 0, 0, r * 1.05, r * 0.9, body, outline, outlineWidth);

  ctx.strokeStyle = stripeColor;
  ctx.lineWidth = r * 0.45;
  ctx.lineCap = 'round';
  const stripeCount = tierLevel >= 2 ? 2 : 1;
  const offsets = stripeCount === 1 ? [0.15] : [-0.15, 0.35];
  offsets.forEach((offset) => {
    ctx.beginPath();
    ctx.ellipse(-r * 0.05, offset * r, r * 0.82, r * 0.22, 0, -0.6, 0.6);
    ctx.stroke();
  });

  drawStickerHighlight(ctx, -r * 0.3, -r * 0.3, r * 0.5, r * 0.35);
  drawKawaiiFace(ctx, r * 0.1, -r * 0.05, r * 0.7);

  if (tierLevel >= 1) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(r * 0.35, -r * 0.75);
    ctx.lineTo(r * 0.2, -r * 1.05);
    ctx.moveTo(r * 0.55, -r * 0.7);
    ctx.lineTo(r * 0.5, -r * 1.02);
    ctx.stroke();
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(r * 0.2, -r * 1.05, r * 0.08, 0, Math.PI * 2);
    ctx.arc(r * 0.5, -r * 1.02, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  if (tierLevel >= 2) {
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.moveTo(-r * 1.05, 0);
    ctx.lineTo(-r * 0.7, -r * 0.2);
    ctx.lineTo(-r * 0.7, r * 0.2);
    ctx.closePath();
    ctx.fill();
  }

  if (tierLevel >= 4) {
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.05);
    ctx.lineTo(-r * 0.18, -r * 0.7);
    ctx.lineTo(r * 0.18, -r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
};

const drawKawaiiSnake = (ctx: CanvasRenderingContext2D, tierLevel: number, frameCount: number) => {
  const r = BASE_RADIUS;
  const body = FACTION_CONFIG[Faction.Wood].color;
  const belly = shadeColor(body, 60);
  const outline = OUTLINE_COLOR;
  const bodyWidth = r * 0.85;
  const wiggle = Math.sin(frameCount * 0.2) * r * 0.12;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(-r * 1.3, r * 0.35);
  ctx.quadraticCurveTo(-r * 0.4, -r * 0.75, r * 0.25, -r * 0.15 + wiggle);
  ctx.quadraticCurveTo(r * 0.7, r * 0.3 + wiggle, r * 1.05, -r * 0.05);
  ctx.strokeStyle = outline;
  ctx.lineWidth = bodyWidth + Math.max(4, r * 0.22);
  ctx.stroke();
  ctx.strokeStyle = body;
  ctx.lineWidth = bodyWidth;
  ctx.stroke();

  drawEllipseFillStroke(ctx, r * 1.1, -r * 0.1, r * 0.6, r * 0.55, body, outline, Math.max(4, r * 0.22));
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.25, r * 0.6, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  drawStickerHighlight(ctx, r * 0.7, -r * 0.3, r * 0.35, r * 0.22);
  drawKawaiiFace(ctx, r * 1.15, -r * 0.1, r * 0.45);

  if (tierLevel >= 2) {
    ctx.fillStyle = FACTION_CONFIG[Faction.Wood].secondary;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(r * 1.15, -r * 0.75);
    ctx.quadraticCurveTo(r * 1.4, -r * 0.55, r * 1.0, -r * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  if (tierLevel >= 3) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(-r * 1.35, r * 0.35);
    ctx.lineTo(-r * 1.6, r * 0.1);
    ctx.stroke();
  }

  if (tierLevel >= 4) {
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath();
    ctx.arc(r * 0.4, -r * 0.65, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawKawaiiToad = (ctx: CanvasRenderingContext2D, tierLevel: number, frameCount: number) => {
  const r = BASE_RADIUS;
  const body = FACTION_CONFIG[Faction.Fire].color;
  const outline = OUTLINE_COLOR;
  const outlineWidth = Math.max(4, r * 0.22);
  const bounce = Math.sin(frameCount * 0.18) * r * 0.04;

  drawEllipseFillStroke(ctx, 0, bounce, r * 1.15, r * 0.95, body, outline, outlineWidth);
  ctx.fillStyle = shadeColor(body, 70);
  ctx.beginPath();
  ctx.ellipse(0, bounce + r * 0.25, r * 0.75, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = shadeColor(body, -25);
  ctx.beginPath();
  ctx.ellipse(-r * 0.75, bounce + r * 0.65, r * 0.45, r * 0.22, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.75, bounce + r * 0.65, r * 0.45, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  if (tierLevel >= 1) {
    ctx.fillStyle = shadeColor(body, -35);
    const spots = tierLevel >= 3 ? 5 : 3;
    for (let i = 0; i < spots; i++) {
      ctx.beginPath();
      ctx.arc(-r * 0.4 + i * (r * 0.4), bounce - r * 0.15 + (i % 2) * r * 0.12, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (tierLevel >= 3) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, bounce);
    ctx.lineTo(r * 0.1, bounce - r * 0.2);
    ctx.moveTo(r * 0.2, bounce + r * 0.15);
    ctx.lineTo(r * 0.45, bounce - r * 0.05);
    ctx.stroke();
  }

  if (tierLevel >= 4) {
    ctx.fillStyle = '#7f1d1d';
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath();
    ctx.rect(-r * 0.5, bounce - r * 0.6, r * 0.3, r * 0.2);
    ctx.rect(r * 0.15, bounce - r * 0.6, r * 0.3, r * 0.2);
    ctx.fill();
    ctx.stroke();
  }

  drawStickerHighlight(ctx, -r * 0.35, bounce - r * 0.3, r * 0.45, r * 0.3);
  drawKawaiiFace(ctx, 0, bounce - r * 0.05, r * 0.7);
};

const drawKawaiiSilkworm = (ctx: CanvasRenderingContext2D, tierLevel: number, frameCount: number) => {
  const r = BASE_RADIUS;
  const body = FACTION_CONFIG[Faction.Water].color;
  const outline = OUTLINE_COLOR;
  const outlineWidth = Math.max(4, r * 0.22);
  const flap = Math.sin(frameCount * 0.25) * 0.25;

  if (tierLevel >= 2) {
    const wingScale = tierLevel >= 4 ? 1.0 : 0.65;
    ctx.save();
    ctx.translate(-r * 0.4, -r * 0.55);
    ctx.rotate(-0.4 + flap);
    drawEllipseFillStroke(ctx, 0, 0, r * 0.9 * wingScale, r * 0.55 * wingScale, '#bae6fd', outline, outlineWidth * 0.5);
    ctx.restore();

    ctx.save();
    ctx.translate(r * 0.4, -r * 0.55);
    ctx.rotate(0.4 - flap);
    drawEllipseFillStroke(ctx, 0, 0, r * 0.9 * wingScale, r * 0.55 * wingScale, '#bae6fd', outline, outlineWidth * 0.5);
    ctx.restore();
  }

  drawEllipseFillStroke(ctx, 0, 0, r * 1.1, r * 0.75, body, outline, outlineWidth);
  drawEllipseFillStroke(ctx, -r * 0.75, r * 0.1, r * 0.6, r * 0.5, body, outline, outlineWidth * 0.9);

  ctx.strokeStyle = shadeColor(body, 70);
  ctx.lineWidth = Math.max(2, r * 0.12);
  for (let i = -0.2; i <= 0.4; i += 0.3) {
    ctx.beginPath();
    ctx.ellipse(0, r * i, r * 0.85, r * 0.22, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawStickerHighlight(ctx, -r * 0.3, -r * 0.2, r * 0.5, r * 0.3);
  drawKawaiiFace(ctx, r * 0.1, -r * 0.1, r * 0.6);

  if (tierLevel >= 2) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(r * 0.6, -r * 0.75);
    ctx.lineTo(r * 0.45, -r * 1.0);
    ctx.moveTo(r * 0.85, -r * 0.7);
    ctx.lineTo(r * 0.75, -r * 0.98);
    ctx.stroke();
  }
};

const drawKawaiiScorpion = (ctx: CanvasRenderingContext2D, tierLevel: number, frameCount: number) => {
  const r = BASE_RADIUS;
  const body = FACTION_CONFIG[Faction.Earth].color;
  const outline = OUTLINE_COLOR;
  const outlineWidth = Math.max(4, r * 0.22);
  const tailWiggle = Math.sin(frameCount * 0.2) * r * 0.1;

  drawEllipseFillStroke(ctx, 0, 0, r * 1.05, r * 0.85, body, outline, outlineWidth);
  drawStickerHighlight(ctx, -r * 0.3, -r * 0.25, r * 0.45, r * 0.3);

  const clawSize = r * (0.4 + tierLevel * 0.05);
  ctx.fillStyle = body;
  ctx.strokeStyle = outline;
  ctx.lineWidth = outlineWidth * 0.7;
  ctx.beginPath();
  ctx.ellipse(r * 1.05, -r * 0.35, clawSize, clawSize * 0.7, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 1.05, r * 0.35, clawSize, clawSize * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.beginPath();
  ctx.moveTo(r * 1.3, -r * 0.35);
  ctx.lineTo(r * 1.55, -r * 0.55);
  ctx.moveTo(r * 1.3, r * 0.35);
  ctx.lineTo(r * 1.55, r * 0.55);
  ctx.stroke();

  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.6);
  ctx.quadraticCurveTo(-r * 1.2, -r * 1.2 + tailWiggle, -r * 0.4, -r * 1.4);
  ctx.strokeStyle = outline;
  ctx.lineWidth = r * 0.45 + outlineWidth * 0.6;
  ctx.stroke();
  ctx.strokeStyle = body;
  ctx.lineWidth = r * 0.45;
  ctx.stroke();

  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, -r * 1.4);
  ctx.lineTo(-r * 0.1, -r * 1.2);
  ctx.lineTo(-r * 0.55, -r * 1.15);
  ctx.closePath();
  ctx.fill();

  if (tierLevel >= 3) {
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2, r * 0.1);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.rect(i * r * 0.35 - r * 0.1, -r * 0.35, r * 0.2, r * 0.2);
      ctx.fill();
      ctx.stroke();
    }
  }

  if (tierLevel >= 4) {
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath();
    ctx.arc(0, -r * 0.7, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  drawKawaiiFace(ctx, 0, -r * 0.05, r * 0.65);
};

const drawEntityFrame = (ctx: CanvasRenderingContext2D, faction: Faction, tier: SizeTier, frameCount: number) => {
  const tierOrder = [SizeTier.Larva, SizeTier.Juvenile, SizeTier.Adult, SizeTier.Elder, SizeTier.AncientKing];
  const tierLevel = Math.max(0, tierOrder.indexOf(tier));
  const r = BASE_RADIUS;
  const bob = Math.sin(frameCount * 0.18) * r * (0.06 + tierLevel * 0.01);

  ctx.save();
  ctx.translate(BASE_CENTER, BASE_CENTER + bob);
  drawStickerShadow(ctx, r);

  if (faction === Faction.Metal) drawKawaiiBee(ctx, tierLevel, frameCount);
  if (faction === Faction.Wood) drawKawaiiSnake(ctx, tierLevel, frameCount);
  if (faction === Faction.Fire) drawKawaiiToad(ctx, tierLevel, frameCount);
  if (faction === Faction.Water) drawKawaiiSilkworm(ctx, tierLevel, frameCount);
  if (faction === Faction.Earth) drawKawaiiScorpion(ctx, tierLevel, frameCount);

  ctx.restore();
};

const createSolidCircleTexture = (PIXI: PixiModule, size: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return PIXI.Texture.EMPTY;
  const r = size / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  return PIXI.Texture.from(canvas);
};

const createSoftCircleTexture = (PIXI: PixiModule, size: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return PIXI.Texture.EMPTY;
  const r = size / 2;
  const gradient = ctx.createRadialGradient(r * 0.35, r * 0.35, r * 0.1, r, r, r);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  return PIXI.Texture.from(canvas);
};

const createCrownTexture = (PIXI: PixiModule, size: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return PIXI.Texture.EMPTY;
  ctx.translate(size / 2, size / 2 + 4);
  ctx.fillStyle = '#f59e0b';
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-15, 0);
  ctx.lineTo(-15, -15);
  ctx.lineTo(-5, -5);
  ctx.lineTo(0, -20);
  ctx.lineTo(5, -5);
  ctx.lineTo(15, -15);
  ctx.lineTo(15, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  return PIXI.Texture.from(canvas);
};

const prerenderStaticMap = (ctx: CanvasRenderingContext2D) => {
  const cx = WORLD_WIDTH / 2;
  const cy = WORLD_HEIGHT / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, MAP_RADIUS, 0, Math.PI * 2);
  ctx.clip();

  const sector = (Math.PI * 2) / 5;
  const startAngle = -Math.PI / 2 - sector / 2;

  const zones = [
    { id: Faction.Wood, label: 'MỘC', base: '#064e3b', light: '#10b981' },
    { id: Faction.Water, label: 'THỦY', base: '#1e3a8a', light: '#93c5fd' },
    { id: Faction.Earth, label: 'THỔ', base: '#451a03', light: '#b45309' },
    { id: Faction.Metal, label: 'KIM', base: '#1c1917', light: '#a8a29e' },
    { id: Faction.Fire, label: 'HỎA', base: '#450a0a', light: '#ef4444' },
  ];

  zones.forEach((zone, i) => {
    const start = startAngle + i * sector;
    const end = startAngle + (i + 1) * sector;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, MAP_RADIUS, start, end);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = zone.base;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    if (zone.id === Faction.Wood) {
      ctx.fillStyle = '#065f46';
      for (let k = 0; k < 200; k++) {
        const x = Math.random() * WORLD_WIDTH;
        const y = Math.random() * WORLD_HEIGHT;
        ctx.beginPath();
        ctx.arc(x, y, 15 + Math.random() * 20, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.3;
      for (let k = 0; k < 50; k++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT);
        ctx.bezierCurveTo(
          Math.random() * WORLD_WIDTH,
          Math.random() * WORLD_HEIGHT,
          Math.random() * WORLD_WIDTH,
          Math.random() * WORLD_HEIGHT,
          Math.random() * WORLD_WIDTH,
          Math.random() * WORLD_HEIGHT
        );
        ctx.stroke();
      }
    } else if (zone.id === Faction.Fire) {
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 3;
      for (let k = 0; k < 80; k++) {
        const x = Math.random() * WORLD_WIDTH;
        const y = Math.random() * WORLD_HEIGHT;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.random() * 60 - 30, y + Math.random() * 60 - 30);
        ctx.stroke();
      }
      ctx.fillStyle = '#7f1d1d';
      for (let k = 0; k < 50; k++) {
        ctx.beginPath();
        ctx.arc(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT, 40, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (zone.id === Faction.Water) {
      ctx.fillStyle = '#3b82f6';
      ctx.globalAlpha = 0.2;
      for (let k = 0; k < 100; k++) {
        const x = Math.random() * WORLD_WIDTH;
        const y = Math.random() * WORLD_HEIGHT;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 40, y + 10);
        ctx.lineTo(x + 20, y + 50);
        ctx.fill();
      }
      ctx.fillStyle = 'white';
      ctx.globalAlpha = 0.4;
      for (let k = 0; k < 50; k++) {
        ctx.beginPath();
        ctx.arc(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (zone.id === Faction.Metal) {
      ctx.strokeStyle = '#57534e';
      ctx.lineWidth = 4;
      for (let k = 0; k < 150; k++) {
        const x = Math.random() * WORLD_WIDTH;
        const y = Math.random() * WORLD_HEIGHT;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - 40);
        ctx.stroke();
        ctx.fillStyle = '#78716c';
        ctx.fillRect(x - 5, y - 30, 10, 4);
      }
    } else if (zone.id === Faction.Earth) {
      ctx.fillStyle = '#78350f';
      for (let k = 0; k < 100; k++) {
        const x = Math.random() * WORLD_WIDTH;
        const y = Math.random() * WORLD_HEIGHT;
        const s = 20 + Math.random() * 30;
        ctx.fillRect(x, y, s, s);
      }
    }

    ctx.restore();

    const midAngle = start + sector / 2;
    const textDist = MAP_RADIUS * 0.8;
    const tx = cx + Math.cos(midAngle) * textDist;
    const ty = cy + Math.sin(midAngle) * textDist;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '900 60px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.fillText(zone.label, tx, ty);
  });

  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.arc(cx, cy, MAP_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
};

const getZoneFromPosition = (pos: { x: number; y: number }): Faction | 'Center' => {
  const cx = WORLD_WIDTH / 2;
  const cy = WORLD_HEIGHT / 2;
  const dx = pos.x - cx;
  const dy = pos.y - cy;
  const dSq = dx * dx + dy * dy;

  if (dSq < CENTER_RADIUS * CENTER_RADIUS) return 'Center';

  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += 2 * Math.PI;

  const sector = (Math.PI * 2) / 5;
  const adjustedAngle = (angle + Math.PI / 2 + sector / 2) % (Math.PI * 2);
  const index = Math.floor(adjustedAngle / sector);
  const zones = [Faction.Wood, Faction.Water, Faction.Earth, Faction.Metal, Faction.Fire];
  return zones[index] || Faction.Fire;
};

const createMapTexture = (PIXI: PixiModule) => {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD_WIDTH;
  canvas.height = WORLD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return PIXI.Texture.EMPTY;
  prerenderStaticMap(ctx);
  return PIXI.Texture.from(canvas);
};

const createAbyssTextures = (PIXI: PixiModule) => {
  const size = CENTER_RADIUS * 2 + 80;
  const center = size / 2;

  const gradientCanvas = document.createElement('canvas');
  gradientCanvas.width = size;
  gradientCanvas.height = size;
  const gctx = gradientCanvas.getContext('2d');
  if (gctx) {
    const gradient = gctx.createRadialGradient(center, center, 50, center, center, CENTER_RADIUS);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(0.5, '#4c1d95');
    gradient.addColorStop(1, 'rgba(76, 29, 149, 0)');
    gctx.fillStyle = gradient;
    gctx.beginPath();
    gctx.arc(center, center, CENTER_RADIUS, 0, Math.PI * 2);
    gctx.fill();
  }

  const ringCanvas = document.createElement('canvas');
  ringCanvas.width = size;
  ringCanvas.height = size;
  const rctx = ringCanvas.getContext('2d');
  if (rctx) {
    rctx.strokeStyle = 'rgba(167, 139, 250, 0.3)';
    rctx.lineWidth = 3;
    rctx.setLineDash([20, 15]);
    rctx.beginPath();
    rctx.arc(center, center, CENTER_RADIUS * 0.8, 0, Math.PI * 2);
    rctx.stroke();
  }

  return {
    abyssTexture: PIXI.Texture.from(gradientCanvas),
    abyssRingTexture: PIXI.Texture.from(ringCanvas),
  };
};

const createEntityTextures = (PIXI: PixiModule) => {
  const textures = new Map<string, EntityTextureSet>();
  const factions = Object.values(Faction) as Faction[];
  const tiers = Object.values(SizeTier) as SizeTier[];

  const buildFrames = (faction: Faction, tier: SizeTier, frames: number[]) =>
    frames.map((frameCount) => {
      const canvas = document.createElement('canvas');
      canvas.width = BASE_SIZE;
      canvas.height = BASE_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return PIXI.Texture.EMPTY;
      drawEntityFrame(ctx, faction, tier, frameCount);
      return PIXI.Texture.from(canvas);
    });

  factions.forEach((faction) => {
    tiers.forEach((tier) => {
      textures.set(getEntityKey(faction, tier), {
        idle: buildFrames(faction, tier, ENTITY_IDLE_FRAMES),
        move: buildFrames(faction, tier, ENTITY_MOVE_FRAMES),
      });
    });
  });

  return textures;
};

const createTexturePack = (PIXI: PixiModule): TexturePack => {
  const softCircleTexture = createSoftCircleTexture(PIXI, SOFT_TEXTURE_SIZE);
  const solidCircleTexture = createSolidCircleTexture(PIXI, ITEM_TEXTURE_SIZE);
  const crownTexture = createCrownTexture(PIXI, 64);
  const mapTexture = createMapTexture(PIXI);
  const { abyssTexture, abyssRingTexture } = createAbyssTextures(PIXI);
  const entityTextures = createEntityTextures(PIXI);

  return {
    entityTextures,
    mapTexture,
    abyssTexture,
    abyssRingTexture,
    softCircleTexture,
    solidCircleTexture,
    crownTexture,
  };
};

interface PixiGameCanvasProps {
  gameState: GameState;
  onMouseMove: (x: number, y: number) => void;
  onMouseDown: () => void;
  onMouseUp: () => void;
  enablePointerInput?: boolean;
}

const PixiGameCanvas: React.FC<PixiGameCanvasProps> = ({
  gameState,
  onMouseMove,
  onMouseDown,
  onMouseUp,
  enablePointerInput = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const pixiRef = useRef<PixiModule | null>(null);
  const texturesRef = useRef<TexturePack | null>(null);
  const layersRef = useRef<LayerPack | null>(null);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const frameRef = useRef(0);
  const zoneRadiusRef = useRef<number | null>(null);
  const settingsRef = useRef<GameSettings>(getSettings());
  const appliedQualityRef = useRef<Exclude<QualityMode, 'auto'>>('high');
  const lastQualityChangeRef = useRef(0);
  const fpsAvgRef = useRef(60);
  const lastStatsPublishRef = useRef(0);
  const featureVisibilityRef = useRef({
    particles: true,
    particleLines: true,
    floatingTexts: true,
  });

  const entityMapRef = useRef(new Map<string, EntityVisual>());
  const foodMapRef = useRef(new Map<string, ItemVisual>());
  const powerUpMapRef = useRef(new Map<string, ItemVisual>());
  const projectileMapRef = useRef(new Map<string, ProjectileVisual>());
  const particleMapRef = useRef(new Map<string, Sprite>());
  const floatingTextMapRef = useRef(new Map<string, Text>());
  const labelMapRef = useRef(new Map<string, Text>());
  const crownMapRef = useRef(new Map<string, Sprite>());
  const landmarkMapRef = useRef(new Map<string, LandmarkVisual>());
  const deathBurstRef = useRef<DeathBurst[]>([]);

  const getQualityProfile = (quality: Exclude<QualityMode, 'auto'>) => {
    if (quality === 'low') {
      return { dprCap: 1, particles: false, particleLines: false, floatingTexts: false };
    }
    if (quality === 'medium') {
      return { dprCap: 1.5, particles: true, particleLines: false, floatingTexts: true };
    }
    return { dprCap: 2, particles: true, particleLines: true, floatingTexts: true };
  };

  const computeEffectiveDpr = () => {
    const settings = settingsRef.current;
    const quality = appliedQualityRef.current;
    const profile = getQualityProfile(quality);
    const device = window.devicePixelRatio || 1;
    const cap = settings.qualityMode === 'auto' ? profile.dprCap : getQualityProfile(settings.qualityMode as Exclude<QualityMode, 'auto'>).dprCap;
    return Math.min(device, cap);
  };

  useEffect(() => {
    let destroyed = false;
    let cleanupResize: (() => void) | null = null;
    const unsubscribeSettings = subscribeSettings(() => {
      settingsRef.current = getSettings();
    });

	    const setup = async () => {
	      if (!containerRef.current) return;
	      const PIXI = await import('pixi.js');
	      if (destroyed) return;

	      pixiRef.current = PIXI;

	      const app = new PIXI.Application();
	      await app.init({
	        width: window.innerWidth,
	        height: window.innerHeight,
	        backgroundColor: hexToNumber(COLOR_PALETTE.background),
	        antialias: true,
	        resolution: computeEffectiveDpr(),
	        autoDensity: true,
	      });
	      appRef.current = app;

	      containerRef.current.appendChild(app.canvas);
	      app.canvas.style.width = '100%';
	      app.canvas.style.height = '100%';

      const textures = createTexturePack(PIXI);
      texturesRef.current = textures;

      const world = new PIXI.Container();
      const background = new PIXI.Container();
      const lava = new PIXI.Graphics();
      const zone = new PIXI.Graphics();
      const hazards = new PIXI.Graphics();
      const landmarks = new PIXI.Container();
      const food = new PIXI.Container();
      const powerUps = new PIXI.Container();
      const trails = new PIXI.Graphics();
      const projectiles = new PIXI.Container();
      const entities = new PIXI.Container();
      entities.sortableChildren = true;
      const rings = new PIXI.Graphics();
      const labels = new PIXI.Container();
	      const particles = new PIXI.ParticleContainer({
	        texture: textures.softCircleTexture,
	        dynamicProperties: {
	          position: true,
	          vertex: true,
	          color: true,
	        },
	      });
      const particleLines = new PIXI.Graphics();
      const floatingTexts = new PIXI.Container();
      const death = new PIXI.Container();

      const mapSprite = new PIXI.Sprite(textures.mapTexture);
      mapSprite.position.set(0, 0);
      background.addChild(mapSprite);

      const abyssSprite = new PIXI.Sprite(textures.abyssTexture);
      abyssSprite.anchor.set(0.5);
      abyssSprite.position.set(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
      background.addChild(abyssSprite);

      const abyssRing = new PIXI.Sprite(textures.abyssRingTexture);
      abyssRing.anchor.set(0.5);
      abyssRing.position.set(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
      background.addChild(abyssRing);

	      const abyssText = new PIXI.Text({
	        text: 'VỰC VẠN CỔ',
	        style: {
	          fontFamily: '"Cinzel", serif',
	          fontSize: 24,
	          fontWeight: 'bold',
	          fill: 'rgba(255,255,255,0.7)',
	        },
	      });
      abyssText.anchor.set(0.5);
      abyssText.position.set(WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 10);
      background.addChild(abyssText);

      world.addChild(background);
      world.addChild(lava);
      world.addChild(zone);
      world.addChild(landmarks);
      world.addChild(hazards);
      world.addChild(food);
      world.addChild(powerUps);
      world.addChild(trails);
      world.addChild(projectiles);
      world.addChild(entities);
      world.addChild(rings);
      world.addChild(labels);
      world.addChild(death);
      world.addChild(particles);
      world.addChild(particleLines);
      world.addChild(floatingTexts);

      app.stage.addChild(world);

      const screenOverlay = new PIXI.Graphics();
      app.stage.addChild(screenOverlay);

      layersRef.current = {
        world,
        background,
        lava,
        zone,
        hazards,
        landmarks,
        food,
        powerUps,
        trails,
        projectiles,
        entities,
        rings,
        labels,
        particles,
        particleLines,
        floatingTexts,
        death,
        screenOverlay,
        abyssRing,
      };

      const updateSize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const dpr = computeEffectiveDpr();
        sizeRef.current = { width, height, dpr };
        app.renderer.resolution = dpr;
        app.renderer.resize(width, height);
      };

      updateSize();
      window.addEventListener('resize', updateSize);
      cleanupResize = () => window.removeEventListener('resize', updateSize);

	      const updateScene = (ticker: Ticker) => {
	        const delta = ticker.deltaTime;
	        const deltaSeconds = ticker.deltaMS / 1000;
	        const now = performance.now();
	        const fpsNow = ticker.deltaMS > 0 ? 1000 / ticker.deltaMS : 60;
	        fpsAvgRef.current = fpsAvgRef.current * 0.92 + fpsNow * 0.08;

        const settings = settingsRef.current;
        if (settings.qualityMode === 'auto') {
          const avg = fpsAvgRef.current;
          const cooldownMs = 2500;
          const canChange = now - lastQualityChangeRef.current > cooldownMs;
          if (canChange && avg < 46 && appliedQualityRef.current !== 'low') {
            appliedQualityRef.current = appliedQualityRef.current === 'high' ? 'medium' : 'low';
            lastQualityChangeRef.current = now;
          } else if (canChange && avg > 57 && appliedQualityRef.current !== 'high') {
            appliedQualityRef.current = appliedQualityRef.current === 'low' ? 'medium' : 'high';
            lastQualityChangeRef.current = now;
          }
        } else {
          appliedQualityRef.current = settings.qualityMode as Exclude<QualityMode, 'auto'>;
        }

        const profile = getQualityProfile(appliedQualityRef.current);
        const desiredDpr = Math.min(window.devicePixelRatio || 1, profile.dprCap);
        if (Math.abs(desiredDpr - sizeRef.current.dpr) > 0.01) {
          sizeRef.current.dpr = desiredDpr;
          app.renderer.resolution = desiredDpr;
          app.renderer.resize(sizeRef.current.width || window.innerWidth, sizeRef.current.height || window.innerHeight);
        }

        const layers = layersRef.current;
        if (layers) {
          const particlesVisible = settings.showParticles && profile.particles;
          const particleLinesVisible = settings.showParticleLines && profile.particleLines;
          const floatingTextsVisible = settings.showFloatingTexts && profile.floatingTexts;

          if (featureVisibilityRef.current.particles !== particlesVisible) {
            featureVisibilityRef.current.particles = particlesVisible;
            if (!particlesVisible) {
              particleMapRef.current.forEach((sprite) => sprite.destroy());
              particleMapRef.current.clear();
              layers.particles.removeChildren();
            }
          }
          if (featureVisibilityRef.current.particleLines !== particleLinesVisible) {
            featureVisibilityRef.current.particleLines = particleLinesVisible;
            if (!particleLinesVisible) layers.particleLines.clear();
          }
          if (featureVisibilityRef.current.floatingTexts !== floatingTextsVisible) {
            featureVisibilityRef.current.floatingTexts = floatingTextsVisible;
            if (!floatingTextsVisible) {
              floatingTextMapRef.current.forEach((text) => text.destroy());
              floatingTextMapRef.current.clear();
              layers.floatingTexts.removeChildren();
            }
          }

          layers.particles.visible = particlesVisible;
          layers.particleLines.visible = particleLinesVisible;
          layers.floatingTexts.visible = floatingTextsVisible;
        }

        const state = gameState;
        const resources = texturesRef.current;
        if (!layers || !resources) return;

        frameRef.current += delta;
        const frame = frameRef.current;
        const { width, height } = sizeRef.current;
        const halfWidth = width / 2;
        const halfHeight = height / 2;

        layers.world.position.set(halfWidth - state.camera.x, halfHeight - state.camera.y);
        layers.abyssRing.rotation = frame * 0.005;

        const viewLeft = state.camera.x - halfWidth;
        const viewRight = state.camera.x + halfWidth;
        const viewTop = state.camera.y - halfHeight;
        const viewBottom = state.camera.y + halfHeight;
        const inView = (pos: { x: number; y: number }, radius: number = 0) =>
          pos.x + radius >= viewLeft - VIEW_BUFFER &&
          pos.x - radius <= viewRight + VIEW_BUFFER &&
          pos.y + radius >= viewTop - VIEW_BUFFER &&
          pos.y - radius <= viewBottom + VIEW_BUFFER;

        const playerZone = getZoneFromPosition(state.player.position);
        let visionRadius = Infinity;
        const visionFactor = state.player.visionMultiplier * state.player.statusEffects.visionBoost;
        if (playerZone === Faction.Wood && state.player.faction !== Faction.Wood) {
          visionRadius = 380 * visionFactor;
        }
        if (playerZone === Faction.Earth && state.hazardTimers?.dustStormActive && state.player.faction !== Faction.Water) {
          visionRadius = 320 * visionFactor;
        }
        const visionRadiusSq = visionRadius === Infinity ? Infinity : visionRadius * visionRadius;
        const inVision = (pos: { x: number; y: number }) =>
          visionRadiusSq === Infinity || distSq(pos, state.player.position) <= visionRadiusSq;

	        if (zoneRadiusRef.current !== state.zoneRadius) {
	          layers.zone.clear();
	          const zoneFill = parsePixiColor(COLOR_PALETTE.zone);
	          layers.zone.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill({ color: zoneFill.tint, alpha: zoneFill.alpha });
	          layers.zone.circle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, state.zoneRadius).cut();
	          layers.zone
	            .circle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, state.zoneRadius)
	            .stroke({ width: 6, color: hexToNumber(COLOR_PALETTE.zoneBorder), alpha: 1 });
	          zoneRadiusRef.current = state.zoneRadius;
	        }

        layers.lava.clear();
        if (state.lavaZones) {
          state.lavaZones.forEach((zone) => {
            if (!inView(zone.position, zone.radius)) return;
            if (!inVision(zone.position)) return;
            const alpha = 0.5 + Math.sin(frame * 0.1) * 0.2;
            layers.lava.circle(zone.position.x, zone.position.y, zone.radius).fill({ color: 0xf97316, alpha });
            const pulse = zone.radius * (0.55 + Math.abs(Math.sin(frame * 0.2)) * 0.45);
            layers.lava.circle(zone.position.x, zone.position.y, pulse).stroke({ width: 3, color: 0x7c2d12, alpha: 1 });
          });
        }

        layers.hazards.clear();
        state.hazards?.forEach((hazard) => {
          if (!hazard.active && hazard.duration <= 0 && (hazard.type === 'lightning' || hazard.type === 'geyser' || hazard.type === 'icicle')) {
            return;
          }
          if (!inView(hazard.position, hazard.radius)) return;
          if (!inVision(hazard.position)) return;

          const hx = hazard.position.x;
          const hy = hazard.position.y;
          const hr = hazard.radius;

          if (hazard.type === 'lightning') {
            layers.hazards.circle(hx, hy, hr).stroke({
              width: 3,
              color: hazard.active ? 0xef4444 : 0xfacc15,
              alpha: hazard.active ? 0.8 : 0.9,
            });
          } else if (hazard.type === 'geyser') {
            layers.hazards.circle(hx, hy, hr).stroke({ width: 3, color: 0xf97316, alpha: 0.8 });
          } else if (hazard.type === 'icicle') {
            layers.hazards.circle(hx, hy, hr).stroke({ width: 3, color: 0x38bdf8, alpha: 0.8 });
          } else if (hazard.type === 'vines') {
            layers.hazards.circle(hx, hy, hr).fill({ color: 0x22c55e, alpha: 0.2 });
          } else if (hazard.type === 'thin_ice') {
            layers.hazards.circle(hx, hy, hr).fill({ color: 0x7dd3fc, alpha: 0.2 });
          } else if (hazard.type === 'wind') {
            layers.hazards.circle(hx, hy, hr).stroke({ width: 2, color: 0x94a3b8, alpha: 0.6 });
          } else if (hazard.type === 'mushroom') {
            layers.hazards.circle(hx, hy, hr).stroke({ width: 2, color: 0xa855f7, alpha: 0.6 });
          } else if (hazard.type === 'spear') {
            layers.hazards.circle(hx, hy, hr).stroke({ width: 2, color: 0x94a3b8, alpha: 0.5 });
          }
        });

        const landmarkIds = new Set<string>();
        state.landmarks?.forEach((landmark) => {
          landmarkIds.add(landmark.id);
          let visual = landmarkMapRef.current.get(landmark.id);
          if (!visual) {
            const ring = new PIXI.Graphics();
            ring.circle(0, 0, landmark.radius).stroke({ width: 3, color: 0xfacc15, alpha: 0.6 });
            const labelText =
              landmark.type === 'fire_furnace'
                ? 'LÒ LỬA'
                : landmark.type === 'wood_tree'
                  ? 'CÂY MẸ'
                  : landmark.type === 'water_statue'
                    ? 'TƯỢNG BĂNG'
                    : landmark.type === 'metal_altar'
                      ? 'ĐÀI KIẾM'
                      : 'KIM TỰ THÁP';
	            const label = new PIXI.Text({
	              text: labelText,
	              style: {
	                fontFamily: '"Cinzel", serif',
	                fontSize: 16,
	                fontWeight: 'bold',
	                fill: '#e2e8f0',
	              },
	            });
            label.anchor.set(0.5);
            const container = new PIXI.Container();
            container.addChild(ring);
            container.addChild(label);
            layers.landmarks.addChild(container);
            visual = { container, ring, label };
            landmarkMapRef.current.set(landmark.id, visual);
          }
          visual.container.visible = inView(landmark.position, landmark.radius);
          visual.container.position.set(landmark.position.x, landmark.position.y);
          visual.label.position.set(0, -landmark.radius - 10);
        });
        landmarkMapRef.current.forEach((visual, id) => {
          if (!landmarkIds.has(id)) {
            layers.landmarks.removeChild(visual.container);
            visual.container.destroy({ children: true });
            landmarkMapRef.current.delete(id);
          }
        });

        const foodActiveIds = new Set<string>();
        const foodVisibleIds = new Set<string>();
        state.food.forEach((f) => {
          if (f.isDead) return;
          foodActiveIds.add(f.id);
          if (!inView(f.position, f.radius)) return;
          if (!inVision(f.position)) return;
          foodVisibleIds.add(f.id);

          let visual = foodMapRef.current.get(f.id);
          if (!visual) {
            const base = new PIXI.Sprite(resources.solidCircleTexture);
            base.anchor.set(0.5);
            const highlight = new PIXI.Sprite(resources.softCircleTexture);
            highlight.anchor.set(0.5);
            highlight.alpha = 0.4;
            highlight.scale.set(0.35);
            highlight.position.set(-6, -6);
            const glow = new PIXI.Sprite(resources.softCircleTexture);
            glow.anchor.set(0.5);
	            glow.blendMode = 'add';
            glow.visible = false;
            const ring = new PIXI.Graphics();
            const container = new PIXI.Container();
            container.addChild(glow, base, highlight, ring);
            layers.food.addChild(container);
            visual = { container, base, highlight, glow, ring };
            foodMapRef.current.set(f.id, visual);
          }

          visual.container.position.set(f.position.x, f.position.y);
          const scale = f.radius / (ITEM_TEXTURE_SIZE / 2);
          visual.container.scale.set(scale);
          visual.base.tint = hexToNumber(f.color);
          if (f.kind === 'relic') {
            visual.glow!.visible = true;
            visual.glow!.tint = 0xfacc15;
            visual.glow!.alpha = 0.7 + Math.sin(frame * 0.1) * 0.1;
            visual.glow!.scale.set(0.9);
            visual.ring!.clear();
            visual.ring!.circle(0, 0, (ITEM_TEXTURE_SIZE / 2) * 1.2).stroke({ width: 3, color: 0x78350f, alpha: 1 });
          } else {
            visual.glow!.visible = false;
            visual.ring!.clear();
          }
          visual.kind = f.kind;
        });
        foodMapRef.current.forEach((visual, id) => {
          if (!foodActiveIds.has(id)) {
            layers.food.removeChild(visual.container);
            visual.container.destroy({ children: true });
            foodMapRef.current.delete(id);
          } else {
            visual.container.visible = foodVisibleIds.has(id);
          }
        });

        const powerActiveIds = new Set<string>();
        const powerVisibleIds = new Set<string>();
        state.powerUps.forEach((p) => {
          if (p.isDead) return;
          powerActiveIds.add(p.id);
          if (!inView(p.position, p.radius)) return;
          if (!inVision(p.position)) return;
          powerVisibleIds.add(p.id);

          let visual = powerUpMapRef.current.get(p.id);
          if (!visual) {
            const base = new PIXI.Sprite(resources.solidCircleTexture);
            base.anchor.set(0.5);
            const glow = new PIXI.Sprite(resources.softCircleTexture);
            glow.anchor.set(0.5);
	            glow.blendMode = 'add';
            const container = new PIXI.Container();
            container.addChild(glow, base);
            layers.powerUps.addChild(container);
            visual = { container, base, glow };
            powerUpMapRef.current.set(p.id, visual);
          }

          visual.container.position.set(p.position.x, p.position.y);
          const scale = p.radius / (ITEM_TEXTURE_SIZE / 2);
          visual.container.scale.set(scale);
          visual.base.tint = hexToNumber(p.color);
          visual.glow!.tint = hexToNumber(p.color);
          visual.glow!.alpha = 0.6 + Math.sin(frame * 0.12) * 0.2;
          visual.glow!.scale.set(0.9);
        });
        powerUpMapRef.current.forEach((visual, id) => {
          if (!powerActiveIds.has(id)) {
            layers.powerUps.removeChild(visual.container);
            visual.container.destroy({ children: true });
            powerUpMapRef.current.delete(id);
          } else {
            visual.container.visible = powerVisibleIds.has(id);
          }
        });

        const projectileActiveIds = new Set<string>();
        const projectileVisibleIds = new Set<string>();
        state.projectiles.forEach((proj) => {
          if (proj.isDead) return;
          projectileActiveIds.add(proj.id);
          if (!inView(proj.position, 20)) return;
          projectileVisibleIds.add(proj.id);

          let visual = projectileMapRef.current.get(proj.id);
          if (!visual) {
            const base = new PIXI.Sprite(resources.solidCircleTexture);
            base.anchor.set(0.5);
            const glow = new PIXI.Sprite(resources.softCircleTexture);
            glow.anchor.set(0.5);
	            glow.blendMode = 'add';
            const container = new PIXI.Container();
            container.addChild(glow, base);
            layers.projectiles.addChild(container);
            visual = { container, base, glow };
            projectileMapRef.current.set(proj.id, visual);
          }

          visual.container.position.set(proj.position.x, proj.position.y);
          const scale = 10 / (ITEM_TEXTURE_SIZE / 2);
          visual.container.scale.set(scale);
          visual.base.tint = hexToNumber(proj.color);
          visual.glow.tint = hexToNumber(proj.color);
          visual.glow.alpha = 0.4;
          visual.glow.scale.set(1.3);
        });
        projectileMapRef.current.forEach((visual, id) => {
          if (!projectileActiveIds.has(id)) {
            layers.projectiles.removeChild(visual.container);
            visual.container.destroy({ children: true });
            projectileMapRef.current.delete(id);
          } else {
            visual.container.visible = projectileVisibleIds.has(id);
          }
        });

        layers.trails.clear();
        const entitiesList: Array<Player | Bot> = [state.player, ...state.bots, ...state.creeps];
        if (state.boss) entitiesList.push(state.boss);

        entitiesList.forEach((entity) => {
          if (entity.isDead || !entity.trail.length) return;
          if (!inView(entity.position, entity.radius * 4)) return;
          if (!inVision(entity.position)) return;
          const config = FACTION_CONFIG[entity.faction];
          layers.trails.moveTo(entity.trail[0].x, entity.trail[0].y);
          for (let i = 1; i < entity.trail.length; i++) {
            layers.trails.lineTo(entity.trail[i].x, entity.trail[i].y);
          }
          layers.trails.stroke({ width: Math.max(2, entity.radius * 0.4), color: hexToNumber(config.color), alpha: 0.2 });
        });

        layers.rings.clear();
        const labelSeen = new Set<string>();
        const crownSeen = new Set<string>();

        entitiesList.sort((a, b) => a.radius - b.radius);
        entitiesList.forEach((entity) => {
          const isPlayer = entity.id === state.player.id;
          if (entity.isDead) {
            const existing = entityMapRef.current.get(entity.id);
            if (existing) {
              layers.entities.removeChild(existing.container);
              existing.container.destroy({ children: true });
              entityMapRef.current.delete(entity.id);
              const burst = createDeathBurst(entity.position.x, entity.position.y, resources, PIXI, FACTION_CONFIG[entity.faction].secondary);
              layers.death.addChild(burst.container);
              deathBurstRef.current.push(burst);
            }
            return;
          }

          let visual = entityMapRef.current.get(entity.id);
          if (!visual) {
            const textures = resources.entityTextures.get(getEntityKey(entity.faction, entity.tier));
            if (!textures) return;
            const sprite = new PIXI.AnimatedSprite(textures.idle);
            sprite.anchor.set(0.5);
            sprite.animationSpeed = 0.08;
            sprite.play();

            const glow = new PIXI.Sprite(resources.softCircleTexture);
            glow.anchor.set(0.5);
	            glow.blendMode = 'add';
            glow.visible = false;

            const poison = new PIXI.Sprite(resources.softCircleTexture);
            poison.anchor.set(0.5);
            poison.visible = false;

            const damage = new PIXI.Sprite(resources.solidCircleTexture);
            damage.anchor.set(0.5);
            damage.tint = 0xef4444;
            damage.alpha = 0;

            const shield = new PIXI.Graphics();

            const container = new PIXI.Container();
            container.sortableChildren = true;
            glow.zIndex = 0;
            poison.zIndex = 1;
            sprite.zIndex = 2;
            damage.zIndex = 3;
            shield.zIndex = 4;
            container.addChild(glow, poison, sprite, damage, shield);

            layers.entities.addChild(container);
            visual = { container, sprite, glow, poison, damage, shield, tier: entity.tier, state: 'idle' };
            entityMapRef.current.set(entity.id, visual);
          }

          const timeSinceSpawn = Math.max(0, state.gameTime - entity.spawnTime);
          const spawnProgress = Math.min(1, timeSinceSpawn / SPAWN_DURATION);
          const spawnScale = 0.6 + spawnProgress * 0.4;
          const stealthAlpha = entity.statusEffects.stealthed && !isPlayer ? 0.2 : 1;

          const baseScale = entity.radius / BASE_RADIUS;
          const airborneScale = entity.statusEffects.airborne ? 1.45 + Math.sin(frame * 0.2) * 0.15 : 1;
          visual.container.scale.set(baseScale * spawnScale * airborneScale);
          visual.container.position.set(entity.position.x, entity.position.y);
          visual.container.alpha = spawnProgress * stealthAlpha;
          visual.container.visible = inView(entity.position, entity.radius * 3) && inVision(entity.position);
          visual.container.zIndex = entity.radius;

          const speed = Math.hypot(entity.velocity.x, entity.velocity.y);
          const nextState: SpriteState = speed > 2 ? 'move' : 'idle';
          if (visual.tier !== entity.tier || visual.state !== nextState) {
            const textures = resources.entityTextures.get(getEntityKey(entity.faction, entity.tier));
            if (textures) {
              visual.sprite.textures = textures[nextState];
              visual.sprite.play();
            }
            visual.tier = entity.tier;
            visual.state = nextState;
          }
          visual.sprite.animationSpeed = nextState === 'move' ? 0.18 : 0.08;
          const angle = Math.atan2(entity.velocity.y, entity.velocity.x);
          visual.sprite.rotation = Number.isFinite(angle) ? angle : 0;

          const glowScaleBase = BASE_RADIUS / (SOFT_TEXTURE_SIZE / 2);
          visual.glow.visible = entity.tier !== SizeTier.Larva;
          if (visual.glow.visible) {
            const glowConfig =
              entity.tier === SizeTier.Juvenile
                ? { color: 0xffffff, alpha: 0.15, size: 1.6 }
                : entity.tier === SizeTier.Adult
                  ? { color: 0x64c8ff, alpha: 0.25, size: 1.8 }
                  : entity.tier === SizeTier.Elder
                    ? { color: 0xc864ff, alpha: 0.35, size: 2.0 }
                    : { color: 0xffd700, alpha: 0.6, size: 2.4 };
            visual.glow.tint = glowConfig.color;
            visual.glow.alpha = glowConfig.alpha;
            visual.glow.scale.set(glowScaleBase * glowConfig.size);
          }

          visual.poison.visible = entity.statusEffects.poisoned;
          if (visual.poison.visible) {
            visual.poison.tint = 0x84cc16;
            visual.poison.alpha = 0.4;
            visual.poison.scale.set(glowScaleBase * 2.2);
          }

          visual.damage.alpha = Math.min(1, entity.statusEffects.damageFlash * 0.7);
          visual.damage.visible = visual.damage.alpha > 0.02;
          visual.damage.scale.set(1.1, 0.95);

          visual.shield.clear();
          if (entity.statusEffects.kingForm > 0) {
            visual.shield.circle(0, 0, BASE_RADIUS * 1.4).stroke({ width: 4, color: 0xf59e0b, alpha: 0.6 });
          }
          if (entity.statusEffects.shielded) {
            const pulse = 0.6 + Math.sin(frame * 0.2) * 0.2;
            visual.shield.circle(0, 0, BASE_RADIUS + 5).stroke({ width: 5, color: 0xeab308, alpha: pulse });
          }

          if (!isPlayer && visual.container.visible) {
            const ratio = entity.radius / state.player.radius;
            let ringColor: number | null = null;
            if (ratio >= DANGER_THRESHOLD_RATIO) ringColor = hexToNumber(COLOR_PALETTE.indicatorDanger);
            else if (ratio <= EAT_THRESHOLD_RATIO) ringColor = hexToNumber(COLOR_PALETTE.indicatorSafe);
            else {
              if (ELEMENTAL_ADVANTAGE[state.player.faction] === entity.faction) ringColor = hexToNumber(COLOR_PALETTE.indicatorCounter);
              else if (ELEMENTAL_ADVANTAGE[entity.faction] === state.player.faction) ringColor = hexToNumber(COLOR_PALETTE.indicatorCountered);
              else ringColor = hexToNumber(COLOR_PALETTE.indicatorCombat);
            }
            if (ringColor) {
              layers.rings.circle(entity.position.x, entity.position.y, entity.radius + 8).stroke({ width: 4, color: ringColor, alpha: 1 });
            }
          }

          if (entity.radius > 20) {
            labelSeen.add(entity.id);
            let label = labelMapRef.current.get(entity.id);
            if (!label) {
	              label = new PIXI.Text({
	                text: entity.name || 'Bot',
	                style: {
	                  fontFamily: '"Roboto", sans-serif',
	                  fontSize: Math.max(12, entity.radius * 0.35),
	                  fontWeight: 'bold',
	                  fill: '#ffffff',
	                  stroke: { color: '#000000', width: 2 },
	                },
	              });
              label.anchor.set(0.5);
              layers.labels.addChild(label);
              labelMapRef.current.set(entity.id, label);
            }
            label.text = entity.name || 'Bot';
            label.style.fontSize = Math.max(12, entity.radius * 0.35);
            label.position.set(entity.position.x, entity.position.y - entity.radius - 8);
            label.alpha = spawnProgress * stealthAlpha;
            label.visible = visual.container.visible;
          }

          if (entity.id === state.kingId) {
            crownSeen.add(entity.id);
            let crown = crownMapRef.current.get(entity.id);
            if (!crown) {
              crown = new PIXI.Sprite(resources.crownTexture);
              crown.anchor.set(0.5);
              layers.labels.addChild(crown);
              crownMapRef.current.set(entity.id, crown);
            }
            const crownScale = Math.max(0.7, entity.radius / 40);
            crown.scale.set(crownScale);
            crown.position.set(entity.position.x, entity.position.y - entity.radius - 25);
            crown.alpha = spawnProgress;
            crown.visible = visual.container.visible;
          }
        });

        labelMapRef.current.forEach((label, id) => {
          if (!labelSeen.has(id)) {
            layers.labels.removeChild(label);
            label.destroy();
            labelMapRef.current.delete(id);
          }
        });

        crownMapRef.current.forEach((crown, id) => {
          if (!crownSeen.has(id)) {
            layers.labels.removeChild(crown);
            crown.destroy();
            crownMapRef.current.delete(id);
          }
        });

        if (layers.particleLines.visible || layers.particles.visible) {
          if (layers.particleLines.visible) layers.particleLines.clear();
          const particleActiveIds = new Set<string>();
          const particleVisibleIds = new Set<string>();

          state.particles.forEach((p) => {
            if (!inView(p.position, p.radius * 2)) return;
            particleActiveIds.add(p.id);
            particleVisibleIds.add(p.id);
            const lifeRatio = p.maxLife > 0 ? p.life / p.maxLife : p.life;

            if (layers.particleLines.visible && p.style === 'ring') {
              const progress = 1 - Math.max(0, lifeRatio);
              const ringRadius = p.radius * (1 + progress * 1.6);
              layers.particleLines.circle(p.position.x, p.position.y, ringRadius).stroke({
                width: p.lineWidth ?? Math.max(2, p.radius * 0.15),
                color: hexToNumber(p.color),
                alpha: Math.max(0, lifeRatio),
              });
            } else if (layers.particleLines.visible && p.style === 'line') {
              const angle = p.angle ?? Math.atan2(p.velocity.y, p.velocity.x);
              const length = p.lineLength ?? p.radius * 4;
              layers.particleLines.moveTo(
                p.position.x - Math.cos(angle) * length * 0.5,
                p.position.y - Math.sin(angle) * length * 0.5
              );
              layers.particleLines.lineTo(
                p.position.x + Math.cos(angle) * length * 0.5,
                p.position.y + Math.sin(angle) * length * 0.5
              );
              layers.particleLines.stroke({
                width: p.lineWidth ?? Math.max(2, p.radius * 0.2),
                color: hexToNumber(p.color),
                alpha: Math.max(0, lifeRatio),
              });
            } else if (layers.particles.visible) {
              let sprite = particleMapRef.current.get(p.id);
              if (!sprite) {
                sprite = new PIXI.Sprite(resources.softCircleTexture);
                sprite.anchor.set(0.5);
                layers.particles.addChild(sprite);
                particleMapRef.current.set(p.id, sprite);
              }
              sprite.position.set(p.position.x, p.position.y);
              sprite.tint = hexToNumber(p.color);
              sprite.alpha = p.life;
              const scale = p.radius / (SOFT_TEXTURE_SIZE / 2);
              sprite.scale.set(scale);
            }
          });

          particleMapRef.current.forEach((sprite, id) => {
            if (!particleActiveIds.has(id)) {
              layers.particles.removeChild(sprite);
              sprite.destroy();
              particleMapRef.current.delete(id);
            } else {
              sprite.visible = particleVisibleIds.has(id);
            }
          });
        }

        if (layers.floatingTexts.visible) {
          const floatingActiveIds = new Set<string>();
          const floatingVisibleIds = new Set<string>();
          state.floatingTexts.forEach((t) => {
            floatingActiveIds.add(t.id);
            if (!inView(t.position, 40)) return;
            floatingVisibleIds.add(t.id);

            let text = floatingTextMapRef.current.get(t.id);
            if (!text) {
	              text = new PIXI.Text({
	                text: t.text,
	                style: {
	                  fontFamily: '"Roboto", sans-serif',
	                  fontSize: t.size,
	                  fontWeight: 'bold',
	                  fill: t.color,
	                  stroke: { color: '#000000', width: 2 },
	                },
	              });
              text.anchor.set(0.5);
              layers.floatingTexts.addChild(text);
              floatingTextMapRef.current.set(t.id, text);
            }

            text.text = t.text;
            text.style.fontSize = t.size;
            text.style.fill = t.color;
            text.position.set(t.position.x, t.position.y);
            text.alpha = Math.min(1, t.life * 2);
            const scale = 1 + (1 - t.life) * 0.5;
            text.scale.set(scale);
          });

          floatingTextMapRef.current.forEach((text, id) => {
            if (!floatingActiveIds.has(id)) {
              layers.floatingTexts.removeChild(text);
              text.destroy();
              floatingTextMapRef.current.delete(id);
            } else {
              text.visible = floatingVisibleIds.has(id);
            }
          });
        }

	        const deathBursts = deathBurstRef.current;
	        for (let i = deathBursts.length - 1; i >= 0; i--) {
	          const burst = deathBursts[i];
	          burst.life -= deltaSeconds;
	          const progress = Math.max(0, burst.life / burst.maxLife);
	          burst.container.alpha = progress;
	          burst.particles.forEach((particle) => {
	            particle.sprite.x += particle.velocity.x * delta;
	            particle.sprite.y += particle.velocity.y * delta;
	          });
          if (burst.life <= 0) {
            layers.death.removeChild(burst.container);
            burst.container.destroy({ children: true });
            deathBursts.splice(i, 1);
          }
        }

        layers.screenOverlay.clear();
        if (playerZone === Faction.Earth && state.hazardTimers?.dustStormActive && state.player.faction !== Faction.Water) {
          layers.screenOverlay.rect(0, 0, width, height).fill({ color: 0x785032, alpha: 0.18 });
        }

        if (now - lastStatsPublishRef.current > 250) {
          lastStatsPublishRef.current = now;
          setRuntimeStats({
            fpsNow,
            fpsAvg: fpsAvgRef.current,
            appliedQuality: appliedQualityRef.current,
            dpr: sizeRef.current.dpr,
          });
        }
      };

      app.ticker.add(updateScene);
    };

    setup();

	    return () => {
	      destroyed = true;
	      unsubscribeSettings();
	      cleanupResize?.();
	      if (appRef.current) {
	        appRef.current.destroy(
	          { removeView: true },
	          { children: true, texture: true, textureSource: true, context: true }
	        );
	      }
	      appRef.current = null;
	      pixiRef.current = null;
	    };
	  }, [gameState]);

  const handleInput = (e: React.MouseEvent) => {
    if (!enablePointerInput) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    onMouseMove(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!enablePointerInput) return;
    const touch = e.touches[0];
    if (!touch) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    onMouseMove(touch.clientX - rect.left, touch.clientY - rect.top);
  };

  const handleTouchStart = () => {
    if (!enablePointerInput) return;
    onMouseDown();
  };

  const handleTouchEnd = () => {
    if (!enablePointerInput) return;
    onMouseUp();
  };

  return (
    <div
      ref={containerRef}
      className="block w-full h-full cursor-crosshair"
      onMouseMove={handleInput}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    />
  );
};

const createDeathBurst = (
  x: number,
  y: number,
  textures: TexturePack,
  PIXI: PixiModule,
  color: string
): DeathBurst => {
  const container = new PIXI.Container();
  const particles: DeathBurst['particles'] = [];
  for (let i = 0; i < 8; i++) {
    const sprite = new PIXI.Sprite(textures.softCircleTexture);
    sprite.anchor.set(0.5);
    sprite.tint = hexToNumber(color);
    sprite.alpha = 0.9;
    const scale = 0.25 + Math.random() * 0.25;
    sprite.scale.set(scale);
    sprite.position.set(x, y);
    container.addChild(sprite);
    particles.push({
      sprite,
      velocity: {
        x: (Math.random() - 0.5) * 6,
        y: (Math.random() - 0.5) * 6,
      },
    });
  }
  return { container, particles, life: 0.8, maxLife: 0.8 };
};

export default PixiGameCanvas;
