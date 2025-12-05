import { NextResponse } from "next/server";
import amqp from "amqplib";
import redis from "@/lib/redis";

export async function POST(request: Request) {
  let connection;
  let channel;
  
  try {
    const { userId, moduleId } = await request.json();

    if (!userId || !moduleId) {
      return NextResponse.json(
        { error: 'userId and moduleId are required' },
        { status: 400 }
      );
    }

    console.log(`🎖️ [Badge API] Queuing badge check for user: ${userId}`);

    // Create fresh connection
    connection = await amqp.connect(
      process.env.RABBITMQ_URL || "amqp://localhost",
      { heartbeat: 30 }
    );
    
    channel = await connection.createChannel();
    await channel.assertQueue("badge_processing_queue", { durable: false });

    const job = { 
      userId, 
      moduleId, 
      timestamp: Date.now() 
    };
    
    // Send message
    channel.sendToQueue(
      "badge_processing_queue",
      Buffer.from(JSON.stringify(job))
    );

    console.log(`✅ [Badge API] Job sent to RabbitMQ queue`);

    // Mark as processing in Redis
    await redis.set(`badge_processing_${userId}`, "true", "EX", 60);

    // Close properly
    await channel.close();
    await connection.close();

    return NextResponse.json({
      status: "processing",
      message: "Checking for new badges...",
      queuedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ [Badge API] Error:", error);
    
    // Clean up on error
    try {
      if (channel) await channel.close();
    } catch {}
    try {
      if (connection) await connection.close();
    } catch {}
    
    return NextResponse.json(
      { error: 'Failed to queue badge processing' },
      { status: 500 }
    );
  }
}