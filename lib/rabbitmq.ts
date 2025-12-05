import amqp from "amqplib";

export async function getRabbitChannel() {
  try {
    const connection = await amqp.connect(
      process.env.RABBITMQ_URL || "amqp://localhost",
      {
        heartbeat: 30  // Shorter heartbeat
      }
    );
    
    const channel = await connection.createChannel();
    
    // Create the badge processing queue
    await channel.assertQueue("badge_processing_queue", { durable: false });

    console.log("✅ [RabbitMQ] Connected successfully");
    
    // Don't keep connection open - return channel that will be used and closed
    return channel;
  } catch (error) {
    console.error("❌ [RabbitMQ] Connection failed:", error);
    throw error;
  }
}