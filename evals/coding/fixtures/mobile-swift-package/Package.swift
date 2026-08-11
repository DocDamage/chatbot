// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "Library", targets: [.target(name: "Library"), .testTarget(name: "LibraryTests", dependencies: ["Library"])])

