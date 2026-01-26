/**
 * PHASE 3: Message Queue System
 * Asynchronous communication between microservices
 */

import EventEmitter from 'events';
import { logger } from '../server/src/logging/Logger';

export interface Message {
  id: string;
  type: string;
  payload: any;
  timestamp: Date;
  retryCount: number;
  maxRetries?: number;
  delay?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  correlationId?: string;
  sourceService?: string;
  targetService?: string;
}

export interface QueueConfig {
  name: string;
  maxSize: number;
  retryAttempts: number;
  retryDelay: number;
  deadLetterQueue: boolean;
  processors: number;
  batchProcessing: boolean;
  batchSize: number;
}

export interface QueueStats {
  name: string;
  size: number;
  processed: number;
  failed: number;
  processing: number;
  deadLetterCount: number;
  averageProcessingTime: number;
}

export interface MessageProcessor {
  id: string;
  process(message: Message): Promise<void>;
  onError?: (error: Error, message: Message) => void;
  onSuccess?: (message: Message) => void;
}

export class MessageQueue extends EventEmitter {
  private static instance: MessageQueue;
  private queues: Map<string, {
    config: QueueConfig;
    messages: Message[];
    processing: Set<string>;
    deadLetterQueue: Message[];
    processors: MessageProcessor[];
    stats: QueueStats;
  }> = new Map();

  private constructor() {
    super();
    // Initialize default queues
    this.initializeDefaultQueues();
  }

  static getInstance(): MessageQueue {
    if (!MessageQueue.instance) {
      MessageQueue.instance = new MessageQueue();
    }
    return MessageQueue.instance;
  }

  // EIDOLON-V PHASE3: Initialize default queues
  private initializeDefaultQueues(): void {
    // User events queue
    this.createQueue('user-events', {
      name: 'user-events',
      maxSize: 10000,
      retryAttempts: 3,
      retryDelay: 1000,
      deadLetterQueue: true,
      processors: 2,
      batchProcessing: true,
      batchSize: 10
    });

    // Game events queue
    this.createQueue('game-events', {
      name: 'game-events',
      maxSize: 50000,
      retryAttempts: 5,
      retryDelay: 500,
      deadLetterQueue: true,
      processors: 5,
      batchProcessing: true,
      batchSize: 50
    });

    // Analytics queue
    this.createQueue('analytics', {
      name: 'analytics',
      maxSize: 20000,
      retryAttempts: 2,
      retryDelay: 2000,
      deadLetterQueue: true,
      processors: 1,
      batchProcessing: true,
      batchSize: 100
    });

    // Notifications queue
    this.createQueue('notifications', {
      name: 'notifications',
      maxSize: 5000,
      retryAttempts: 3,
      retryDelay: 1500,
      deadLetterQueue: true,
      processors: 1,
      batchProcessing: false,
      batchSize: 1
    });

    // System events queue
    this.createQueue('system-events', {
      name: 'system-events',
      maxSize: 1000,
      retryAttempts: 1,
      retryDelay: 5000,
      deadLetterQueue: true,
      processors: 1,
      batchProcessing: false,
      batchSize: 1
    });
  }

  // EIDOLON-V PHASE3: Create queue
  createQueue(name: string, config: QueueConfig): void {
    if (this.queues.has(name)) {
      throw new Error(`Queue ${name} already exists`);
    }

    this.queues.set(name, {
      config,
      messages: [],
      processing: new Set(),
      deadLetterQueue: [],
      processors: [],
      stats: {
        name,
        size: 0,
        processed: 0,
        failed: 0,
        processing: 0,
        deadLetterCount: 0,
        averageProcessingTime: 0
      }
    });

    logger.info('Queue created', { name, maxSize: config.maxSize });
  }

  // EIDOLON-V PHASE3: Publish message
  async publish(queueName: string, message: Omit<Message, 'retryCount'>): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    // Add metadata
    const fullMessage: Message = {
      ...message,
      id: this.generateMessageId(),
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: queue.config.retryAttempts,
      delay: message.delay || 0,
      priority: message.priority || 'medium'
    };

    // Check queue size
    if (queue.messages.length >= queue.config.maxSize) {
      logger.warn('Queue is full', { queueName, size: queue.messages.length, maxSize: queue.config.maxSize });

      // Add to dead letter queue
      if (queue.config.deadLetterQueue) {
        queue.deadLetterQueue.push(fullMessage);
        queue.stats.deadLetterCount++;
        this.emit('deadLetter', { queueName, message: fullMessage });
      }

      return;
    }

    // Add to queue
    queue.messages.push(fullMessage);
    queue.stats.size = queue.messages.length;

    logger.debug('Message published', { queueName, messageId: fullMessage.id, type: fullMessage.type });

    // Emit event
    this.emit('messagePublished', { queueName, message: fullMessage });

    // Process queue
    this.processQueue(queueName);
  }

  // EIDOLON-V PHASE3: Subscribe to queue
  subscribe(queueName: string, processor: MessageProcessor): void {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    queue.processors.push(processor);

    logger.info('Processor subscribed', { queueName, processorCount: queue.processors.length });

    // Start processing if idle
    if (queue.processors.length > 0 && queue.messages.length > 0) {
      this.processQueue(queueName);
    }
  }

  // EIDOLON-V PHASE3: Process queue
  private async processQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) return;

    // Check if queue is already being processed
    if (queue.processing.size > 0) {
      return;
    }

    // Check if there are messages to process
    if (queue.messages.length === 0) {
      return;
    }

    // Get available processor
    const processor = queue.processors[0];
    queue.processing.add(processor.id);

    try {
      if (queue.config.batchProcessing) {
        await this.processBatch(queueName, processor);
      } else {
        await this.processSingle(queueName, processor);
      }
    } catch (error) {
      logger.error('Queue processing error', { queueName, error: error instanceof Error ? error.message : String(error) }, error instanceof Error ? error : undefined);
    } finally {
      queue.processing.delete(processor.id);

      // Continue processing if there are more messages
      if (queue.messages.length > 0 && queue.processors.length > 0) {
        // Use setImmediate to avoid blocking
        setImmediate(() => this.processQueue(queueName));
      }
    }
  }

  // EIDOLON-V PHASE3: Process single message
  private async processSingle(queueName: string, processor: MessageProcessor): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue || queue.messages.length === 0) return;

    const message = queue.messages.shift();
    queue.stats.size = queue.messages.length;

    const startTime = Date.now();

    try {
      if (message) {
        await processor.process(message);

        // Calculate processing time
        const processingTime = Date.now() - startTime;
        logger.debug('Message processed', { queueName, messageId: message.id, processingTime });

        this.emit('completed', { queueName, message, processingTime });
      }
    } catch (error) {
      logger.error('Message processing failed', { queueName, messageId: message?.id, error: error instanceof Error ? error.message : String(error) }, error instanceof Error ? error : undefined);

      // Handle failure (retry or DLQ)
      if (message) {
        await this.handleFailedMessage(queueName, message, error as Error, processor);
      }
    }
  }

  // EIDOLON-V PHASE3: Process batch of messages
  private async processBatch(queueName: string, processor: MessageProcessor): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue || queue.messages.length === 0) return;

    const batchSize = Math.min(queue.config.batchSize, queue.messages.length);
    const batch = queue.messages.splice(0, batchSize);
    queue.stats.size = queue.messages.length;

    const startTime = Date.now();

    try {
      // Create batch message
      const batchMessage: Message = {
        id: this.generateMessageId(),
        type: 'batch',
        payload: batch,
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: queue.config.retryAttempts,
        priority: 'medium'
      };

      await processor.process(batchMessage);

      const processingTime = Date.now() - startTime;

      // Update stats for all messages in batch
      for (const message of batch) {
        this.updateStats(queueName, processingTime / batch.length, 'success');
      }

      logger.debug('Batch processed', { queueName, batchSize, processingTime });

      // Emit success event for each message
      for (const message of batch) {
        this.emit('messageProcessed', { queueName, message, processingTime: processingTime / batch.length });
      }

    } catch (error) {
      logger.error('Batch processing failed', { queueName, batchSize, error: error instanceof Error ? error.message : String(error) }, error instanceof Error ? error : undefined);

      // Handle retry logic for all messages in batch
      for (const message of batch) {
        await this.handleFailedMessage(queueName, message, error as Error, processor);
      }
    }
  }

  // EIDOLON-V PHASE3: Handle failed message
  private async handleFailedMessage(queueName: string, message: Message, error: Error, processor: MessageProcessor): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) return;

    message.retryCount++;

    // Check if max retries reached
    if (message.retryCount >= (message.maxRetries || queue.config.retryAttempts)) {
      // Move to dead letter queue
      if (queue.config.deadLetterQueue) {
        queue.deadLetterQueue.push(message);
        queue.stats.deadLetterCount++;
        queue.stats.failed++;

        logger.error('Message moved to dead letter queue', {
          queueName,
          messageId: message.id,
          retryCount: message.retryCount,
          error: error.message
        });

        this.emit('deadLetter', { queueName, message });

        // Call error handler if provided
        if (processor.onError) {
          processor.onError(error, message);
        }
      }

      return;
    }

    // Add delay before retry
    const delay = message.delay || queue.config.retryDelay;
    if (delay > 0) {
      await this.sleep(delay);
    }

    // Re-add to queue for retry
    queue.messages.unshift(message);
    queue.stats.size = queue.messages.length;
    queue.stats.failed++;

    logger.warn('Message queued for retry', {
      queueName,
      messageId: message.id,
      retryCount: message.retryCount,
      delay
    });

    // Emit retry event
    this.emit('messageRetry', { queueName, message });
  }

  // EIDOLON-V PHASE3: Update statistics
  private updateStats(queueName: string, processingTime: number, result: 'success' | 'failed'): void {
    const queue = this.queues.get(queueName);
    if (!queue) return;

    if (result === 'success') {
      queue.stats.processed++;
    } else {
      queue.stats.failed++;
    }

    // Update average processing time
    const totalProcessed = queue.stats.processed + queue.stats.failed;
    if (totalProcessed > 0) {
      const currentAvg = queue.stats.averageProcessingTime;
      const newAvg = (currentAvg * (totalProcessed - 1) + processingTime) / totalProcessed;
      queue.stats.averageProcessingTime = newAvg;
    }
  }

  // EIDOLON-V PHASE3: Get queue statistics
  getQueueStats(queueName: string): QueueStats | null {
    const queue = this.queues.get(queueName);
    if (!queue) return null;

    return { ...queue.stats };
  }

  // EIDOLON-V PHASE3: Get all queue statistics
  getAllQueueStats(): Record<string, QueueStats> {
    const stats: Record<string, QueueStats> = {};

    for (const [name, queue] of this.queues) {
      stats[name] = { ...queue.stats };
    }

    return stats;
  }

  // EIDOLON-V PHASE3: Clear queue
  clearQueue(queueName: string): void {
    const queue = this.queues.get(queueName);
    if (!queue) return;

    // Move messages to dead letter queue if configured
    if (queue.config.deadLetterQueue) {
      queue.deadLetterQueue.push(...queue.messages);
      queue.stats.deadLetterCount += queue.messages.length;
    }

    queue.messages = [];
    queue.stats.size = 0;

    logger.info('Queue cleared', { queueName, messagesMoved: queue.config.deadLetterQueue ? queue.messages.length : 0 });
  }

  // EIDOLON-V PHASE3: Generate message ID
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // EIDOLON-V PHASE3: Sleep helper
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // EIDOLON-V PHASE3: Get queue configuration
  getQueueConfig(queueName: string): QueueConfig | null {
    const queue = this.queues.get(queueName);
    return queue ? { ...queue.config } : null;
  }

  // EIDOLON-V PHASE3: Get dead letter queue
  getDeadLetterQueue(queueName: string): Message[] {
    const queue = this.queues.get(queueName);
    return queue ? queue.deadLetterQueue : [];
  }
}

// EIDOLON-V PHASE3: Export singleton instance
export const messageQueue = MessageQueue.getInstance();
