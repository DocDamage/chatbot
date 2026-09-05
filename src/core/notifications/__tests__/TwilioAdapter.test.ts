import { TwilioAdapter } from '../TwilioAdapter';

const mockMessagesCreate = jest.fn();
const mockCallsCreate = jest.fn();
const mockMessagesList = jest.fn();
const mockMessageFetch = jest.fn();
const mockLookupFetch = jest.fn();

jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => ({
    messages: Object.assign(
      (id: string) => ({
        fetch: mockMessageFetch
      }),
      {
        create: mockMessagesCreate,
        list: mockMessagesList
      }
    ),
    calls: {
      create: mockCallsCreate
    },
    lookups: {
      v1: {
        phoneNumbers: (phone: string) => ({
          fetch: mockLookupFetch
        })
      }
    }
  }));
});

describe('RT-NOTIF-001: TwilioAdapter Notification & Voice Suite', () => {
  const originalEnv = { ...process.env };
  let adapter: TwilioAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new TwilioAdapter({
      accountSid: 'AC_TEST_ACCOUNT',
      authToken: 'auth_test_token',
      fromNumber: '+15551234567',
      statusCallback: 'https://example.com/callback'
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('verifies configuration checks and creation from environment variables', () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;

    expect(TwilioAdapter.isConfigured()).toBe(false);
    expect(() => TwilioAdapter.fromEnv()).toThrow('Missing Twilio configuration');

    process.env.TWILIO_ACCOUNT_SID = 'AC1234567890';
    process.env.TWILIO_AUTH_TOKEN = 'auth_token_123';
    process.env.TWILIO_FROM_NUMBER = '+15550001111';

    expect(TwilioAdapter.isConfigured()).toBe(true);
    const envAdapter = TwilioAdapter.fromEnv();
    expect(envAdapter).toBeInstanceOf(TwilioAdapter);
  });

  it('sends SMS and bulk SMS messages with error handling', async () => {
    mockMessagesCreate.mockResolvedValueOnce({ sid: 'msg-001' });

    const smsRes = await adapter.sendSMS('+15559876543', 'Test message & symbols < > "');
    expect(smsRes.success).toBe(true);
    expect(smsRes.messageId).toBe('msg-001');

    // SMS failure
    mockMessagesCreate.mockRejectedValueOnce(new Error('Network error'));
    const failedSms = await adapter.sendSMS('+15559876543', 'Fail message');
    expect(failedSms.success).toBe(false);
    expect(failedSms.error).toBe('Network error');

    // Bulk SMS
    mockMessagesCreate.mockResolvedValue({ sid: 'bulk-msg' });
    jest.spyOn<any, any>(adapter, 'delay').mockResolvedValue(undefined);
    const bulkResults = await adapter.sendBulkSMS(['+15550001', '+15550002'], 'Bulk message');
    expect(bulkResults.length).toBe(2);
    expect(bulkResults[0].success).toBe(true);
  });

  it('makes voice calls and sends urgent alerts', async () => {
    mockCallsCreate.mockResolvedValueOnce({ sid: 'call-001' });

    const callRes = await adapter.makeCall('+15559876543', 'Urgent voice message');
    expect(callRes.success).toBe(true);
    expect(callRes.callId).toBe('call-001');

    // Call failure
    mockCallsCreate.mockRejectedValueOnce(new Error('Call dropped'));
    const failedCall = await adapter.makeCall('+15559876543', 'Voice fail');
    expect(failedCall.success).toBe(false);
    expect(failedCall.error).toBe('Call dropped');

    // sendAlert non-urgent
    mockMessagesCreate.mockResolvedValueOnce({ sid: 'alert-msg' });
    const normalAlert = await adapter.sendAlert('+15559876543', 'Normal alert', false);
    expect(normalAlert.success).toBe(true);

    // sendAlert urgent with SMS fail -> fallback to call
    mockMessagesCreate.mockRejectedValueOnce(new Error('SMS blocked'));
    mockCallsCreate.mockResolvedValueOnce({ sid: 'alert-call' });
    const urgentAlert = await adapter.sendAlert('+15559876543', 'Urgent failover', true);
    expect(urgentAlert.success).toBe(true);
    expect((urgentAlert as any).callId).toBe('alert-call');
  });

  it('retrieves message history, message status, and validates phone numbers', async () => {
    // History
    mockMessagesList.mockResolvedValueOnce([
      { sid: 'm1', to: '+1555', from: '+1555', body: 'hi', status: 'delivered', dateSent: new Date(), direction: 'outbound' }
    ]);
    const history = await adapter.getMessageHistory(5, new Date());
    expect(history.length).toBe(1);

    // History error
    mockMessagesList.mockRejectedValueOnce(new Error('History error'));
    const failedHistory = await adapter.getMessageHistory(5);
    expect(failedHistory).toEqual([]);

    // Status
    mockMessageFetch.mockResolvedValueOnce({ status: 'delivered' });
    const status = await adapter.getMessageStatus('m1');
    expect(status).toBe('delivered');

    mockMessageFetch.mockRejectedValueOnce(new Error('Not found'));
    const missingStatus = await adapter.getMessageStatus('m2');
    expect(missingStatus).toBeNull();

    // Phone validation
    mockLookupFetch.mockResolvedValueOnce({
      phoneNumber: '+15559876543',
      carrier: { type: 'mobile', name: 'CarrierX' }
    });
    const validLookup = await adapter.validatePhoneNumber('+15559876543');
    expect(validLookup.valid).toBe(true);
    expect(validLookup.carrier).toBe('CarrierX');

    mockLookupFetch.mockRejectedValueOnce(new Error('Invalid'));
    const invalidLookup = await adapter.validatePhoneNumber('invalid');
    expect(invalidLookup.valid).toBe(false);
  });
});
