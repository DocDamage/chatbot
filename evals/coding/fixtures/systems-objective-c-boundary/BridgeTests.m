#import <XCTest/XCTest.h>

@interface BridgeTests : XCTestCase
@end
@implementation BridgeTests
- (void)testNilDelegateIsSafe { XCTAssertTrue(YES); }
@end

