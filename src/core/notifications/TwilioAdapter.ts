/**
 * Twilio Adapter - SMS and voice notifications
 * Reference: hacker-scripts automation patterns
 */

import { logger } from '../observability/logger';

// Dynamic import for twilio
let twilioClient: any = null;
let twilioLoaded = false;

async function loadTwilio(accountSid: string, authToken: string): Promise<boolean> {
    if (twilioClient !== null) return twilioLoaded;

    try {
        const twilio = require('twilio');
        twilioClient = twilio(accountSid, authToken);
        twilioLoaded = true;
        logger.info('Twilio client initialized');
        return true;
    } catch (error) {
        logger.warn('Twilio not available - SMS/voice notifications will not work');
        twilioLoaded = false;
        return false;
    }
}

export interface SMSResult {
    success: boolean;
    messageId?: string;
    error?: string;
    to: string;
    timestamp: Date;
}

export interface CallResult {
    success: boolean;
    callId?: string;
    error?: string;
    to: string;
    timestamp: Date;
}

export interface TwilioConfig {
    accountSid: string;
    authToken: string;
    fromNumber: string;
    statusCallback?: string;
}

export class TwilioAdapter {
    private config: TwilioConfig;
    private initialized: boolean = false;

    constructor(config: TwilioConfig) {
        this.config = config;
    }

    /**
     * Initialize the Twilio client
     */
    async initialize(): Promise<boolean> {
        if (this.initialized) return true;

        this.initialized = await loadTwilio(
            this.config.accountSid,
            this.config.authToken
        );

        return this.initialized;
    }

    /**
     * Send an SMS message
     */
    async sendSMS(to: string, message: string): Promise<SMSResult> {
        const timestamp = new Date();

        if (!await this.initialize()) {
            return {
                success: false,
                error: 'Twilio not initialized',
                to,
                timestamp
            };
        }

        try {
            const result = await twilioClient.messages.create({
                body: message,
                from: this.config.fromNumber,
                to,
                statusCallback: this.config.statusCallback
            });

            logger.info('SMS sent successfully', {
                messageId: result.sid,
                to: this.maskPhoneNumber(to)
            });

            return {
                success: true,
                messageId: result.sid,
                to,
                timestamp
            };
        } catch (error: any) {
            logger.error('SMS send failed', {
                error: error.message,
                to: this.maskPhoneNumber(to)
            });

            return {
                success: false,
                error: error.message,
                to,
                timestamp
            };
        }
    }

    /**
     * Send SMS to multiple recipients
     */
    async sendBulkSMS(
        recipients: string[],
        message: string
    ): Promise<SMSResult[]> {
        const results: SMSResult[] = [];

        for (const to of recipients) {
            const result = await this.sendSMS(to, message);
            results.push(result);

            // Rate limiting - Twilio recommends 1 message per second
            await this.delay(1000);
        }

        return results;
    }

    /**
     * Make a voice call with text-to-speech
     */
    async makeCall(to: string, message: string): Promise<CallResult> {
        const timestamp = new Date();

        if (!await this.initialize()) {
            return {
                success: false,
                error: 'Twilio not initialized',
                to,
                timestamp
            };
        }

        try {
            // Create TwiML for text-to-speech
            const twiml = `
        <Response>
          <Say voice="alice">${this.escapeXml(message)}</Say>
          <Pause length="1"/>
          <Say voice="alice">Goodbye.</Say>
        </Response>
      `.trim();

            const result = await twilioClient.calls.create({
                twiml,
                from: this.config.fromNumber,
                to,
                statusCallback: this.config.statusCallback
            });

            logger.info('Call initiated', {
                callId: result.sid,
                to: this.maskPhoneNumber(to)
            });

            return {
                success: true,
                callId: result.sid,
                to,
                timestamp
            };
        } catch (error: any) {
            logger.error('Call failed', {
                error: error.message,
                to: this.maskPhoneNumber(to)
            });

            return {
                success: false,
                error: error.message,
                to,
                timestamp
            };
        }
    }

    /**
     * Send an alert (try SMS, fall back to call for urgent)
     */
    async sendAlert(
        to: string,
        message: string,
        urgent: boolean = false
    ): Promise<SMSResult | CallResult> {
        // Always start with SMS
        const smsResult = await this.sendSMS(to, message);

        // If urgent and SMS failed, try calling
        if (urgent && !smsResult.success) {
            return this.makeCall(to, message);
        }

        return smsResult;
    }

    /**
     * Get message history
     */
    async getMessageHistory(
        limit: number = 20,
        dateSentAfter?: Date
    ): Promise<any[]> {
        if (!await this.initialize()) {
            return [];
        }

        try {
            const options: any = { limit };
            if (dateSentAfter) {
                options.dateSentAfter = dateSentAfter;
            }

            const messages = await twilioClient.messages.list(options);

            return messages.map((m: any) => ({
                id: m.sid,
                to: m.to,
                from: m.from,
                body: m.body,
                status: m.status,
                dateSent: m.dateSent,
                direction: m.direction
            }));
        } catch (error: any) {
            logger.error('Failed to fetch message history', { error: error.message });
            return [];
        }
    }

    /**
     * Check SMS delivery status
     */
    async getMessageStatus(messageId: string): Promise<string | null> {
        if (!await this.initialize()) {
            return null;
        }

        try {
            const message = await twilioClient.messages(messageId).fetch();
            return message.status;
        } catch (error: any) {
            logger.error('Failed to fetch message status', { error: error.message });
            return null;
        }
    }

    /**
     * Validate a phone number
     */
    async validatePhoneNumber(phoneNumber: string): Promise<{
        valid: boolean;
        formatted?: string;
        type?: string;
        carrier?: string;
    }> {
        if (!await this.initialize()) {
            return { valid: false };
        }

        try {
            const result = await twilioClient.lookups.v1
                .phoneNumbers(phoneNumber)
                .fetch({ type: ['carrier'] });

            return {
                valid: true,
                formatted: result.phoneNumber,
                type: result.carrier?.type,
                carrier: result.carrier?.name
            };
        } catch (error: any) {
            return { valid: false };
        }
    }

    /**
     * Mask phone number for logging
     */
    private maskPhoneNumber(phone: string): string {
        if (phone.length <= 4) return '****';
        return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
    }

    /**
     * Escape XML special characters for TwiML
     */
    private escapeXml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Create from environment variables
     */
    static fromEnv(): TwilioAdapter {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_FROM_NUMBER;

        if (!accountSid || !authToken || !fromNumber) {
            throw new Error(
                'Missing Twilio configuration. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER'
            );
        }

        return new TwilioAdapter({
            accountSid,
            authToken,
            fromNumber
        });
    }

    /**
     * Check if Twilio is configured
     */
    static isConfigured(): boolean {
        return !!(
            process.env.TWILIO_ACCOUNT_SID &&
            process.env.TWILIO_AUTH_TOKEN &&
            process.env.TWILIO_FROM_NUMBER
        );
    }
}

export default TwilioAdapter;
