#import <Foundation/Foundation.h>

void notifyDelegate(id delegate, NSString *value) {
    if ([delegate respondsToSelector:@selector(receiveValue:)]) {
        [delegate receiveValue:value ?: @""];
    }
}

