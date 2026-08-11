local normalize = require('src.normalize')
assert(normalize.normalize({ name = 'Ada' }).name == 'ada')

