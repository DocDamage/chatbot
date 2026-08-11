import XCTest
@testable import Library
final class LibraryTests: XCTestCase { func testEmptyIsNil() { XCTAssertNil(Library.normalized("")) } }

