namespace ValidationTests

module Tests =
    let missingRecordIsNone = Validation.Records.findRecord "missing" [] = None

