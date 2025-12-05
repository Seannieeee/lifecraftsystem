import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

import amqp from "amqplib";
import processRecommendation from "./processRecommendation.js";

async function startWorker() {
  try {
    console.log("🔄 [Worker] Starting...");
    
    // Add heartbeat configuration
    const connection = await amqp.connect("amqp://localhost", {
      heartbeat: 60 // Send heartbeat every 60 seconds
    });
    
    const channel = await connection.createChannel();
    
    // Set prefetch to process one message at a time
    await channel.prefetch(1);
    await channel.assertQueue("badge_processing_queue", { durable: false });

    console.log("✅ [Worker] Connected to RabbitMQ");
    console.log("⏳ [Worker] Waiting for badge processing jobs...");

    channel.consume("badge_processing_queue", async (msg) => {
      if (!msg) return;

      const { userId, moduleId, timestamp } = JSON.parse(msg.content.toString());
      
      console.log(`📨 [Worker] Received job:`, { userId, moduleId });
      console.log(`⏱️  [Worker] Queue time: ${Date.now() - timestamp}ms`);

      try {
        await processRecommendation(userId, moduleId);
        console.log(`✅ [Worker] Job completed for user: ${userId}`);
        channel.ack(msg);
      } catch (error) {
        console.error(`❌ [Worker] Job failed:`, error);
        channel.nack(msg, false, false); // Don't requeue on failure
      }
    }, { noAck: false }); // Manual acknowledgment

    connection.on('error', (err) => {
      console.error('❌ [Worker] Connection error:', err);
      process.exit(1);
    });

    connection.on('close', () => {
      console.log('⚠️ [Worker] Connection closed. Reconnecting in 5s...');
      setTimeout(startWorker, 5000);
    });

    // Keep process alive
    process.on('SIGINT', async () => {
      console.log('\n🛑 [Worker] Shutting down gracefully...');
      await channel.close();
      await connection.close();
      process.exit(0);
    });

  } catch (error) {
    console.error("❌ [Worker] Failed to start:", error);
    console.log("🔄 [Worker] Retrying in 5 seconds...");
    setTimeout(startWorker, 5000);
  }
}

startWorker();