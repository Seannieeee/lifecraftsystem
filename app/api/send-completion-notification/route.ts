// app/api/send-completion-notification/route.ts
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { email, fullName, drillTitle, drillDate, drillLocation } = await req.json();

    // Validate required fields
    if (!email || !fullName || !drillTitle) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate environment variables
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS) {
      console.error('Gmail credentials not configured');
      return NextResponse.json(
        { success: false, error: 'Email service not configured' },
        { status: 500 }
      );
    }

    // Create transporter using Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,       // Your Gmail address
        pass: process.env.GMAIL_APP_PASS,   // 16-char App Password
      },
    });

    // Verify transporter configuration
    await transporter.verify();

    const mailOptions = {
      from: `"LifeCraft Training" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `🎉 Drill Completed - ${drillTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 2px solid #000000;">
                    
                    <!-- Header -->
                    <tr>
                      <td style="background-color: #000000; padding: 40px 30px; text-align: center; border-bottom: 3px solid #333333;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: 1px;">
                          🎉 CONGRATULATIONS
                        </h1>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px 30px;">
                        <p style="margin: 0 0 20px; font-size: 16px; color: #000000; line-height: 1.6;">
                          Hello <strong>${fullName}</strong>,
                        </p>
                        
                        <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6;">
                          Great news! You have successfully completed the following drill:
                        </p>
                        
                        <!-- Drill Details Card -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border: 2px solid #000000; border-radius: 6px; margin: 20px 0;">
                          <tr>
                            <td style="padding: 20px;">
                              <h2 style="margin: 0 0 15px; font-size: 20px; color: #000000; font-weight: bold;">
                                ${drillTitle}
                              </h2>
                              ${drillDate ? `
                                <p style="margin: 5px 0; font-size: 14px; color: #333333;">
                                  <strong>Date:</strong> ${new Date(drillDate).toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  })}
                                </p>
                              ` : ''}
                              ${drillLocation ? `
                                <p style="margin: 5px 0; font-size: 14px; color: #333333;">
                                  <strong>Location:</strong> ${drillLocation}
                                </p>
                              ` : ''}
                            </td>
                          </tr>
                        </table>
                        
                        <!-- Certificate Notice -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e8e8e8; border: 2px solid #666666; border-radius: 6px; margin: 20px 0;">
                          <tr>
                            <td style="padding: 20px; text-align: center;">
                              <p style="margin: 0 0 10px; font-size: 16px; color: #000000; font-weight: bold;">
                                📜 Your Certificate is Ready!
                              </p>
                              <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">
                                Your completion certificate is now available in your dashboard and can be downloaded at any time.
                              </p>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="margin: 20px 0 0; font-size: 16px; color: #000000; line-height: 1.6;">
                          Keep up the excellent work in your training journey!
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f0f0f0; padding: 30px; text-align: center; border-top: 2px solid #cccccc;">
                        <p style="margin: 0 0 10px; font-size: 16px; color: #000000; font-weight: bold;">
                          LifeCraft Training Program
                        </p>
                        <p style="margin: 0; font-size: 14px; color: #555555;">
                          Building skills, saving lives
                        </p>
                      </td>
                    </tr>
                    
                  </table>
                  
                  <!-- Disclaimer -->
                  <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
                    <tr>
                      <td style="padding: 0 30px; text-align: center;">
                        <p style="margin: 0; font-size: 12px; color: #888888; line-height: 1.5;">
                          This is an automated notification from LifeCraft Training Program.<br/>
                          Please do not reply to this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                  
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
      // Plain text fallback
      text: `
Hello ${fullName},

Congratulations! You have successfully completed the drill: ${drillTitle}

${drillDate ? `Date: ${new Date(drillDate).toLocaleDateString('en-US', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})}` : ''}
${drillLocation ? `Location: ${drillLocation}` : ''}

Your certificate is now available in your dashboard and can be downloaded at any time.

Keep up the excellent work in your training journey!

— LifeCraft Training Program
Building skills, saving lives
      `.trim(),
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email sent successfully:', info.messageId);
    
    return NextResponse.json({ 
      success: true, 
      messageId: info.messageId,
      message: 'Notification sent successfully' 
    });

  } catch (error: any) {
    console.error('❌ SMTP error:', error);
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'Failed to send notification';
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Gmail authentication failed. Please check your credentials.';
    } else if (error.code === 'ESOCKET') {
      errorMessage = 'Network error. Please check your internet connection.';
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}