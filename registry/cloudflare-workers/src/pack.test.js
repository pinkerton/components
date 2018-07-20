const path = require('path')
const os = require('os')
const crypto = require('crypto')
const fse = require('fs-extra')
const BbPromise = require('bluebird')
const decompress = require('decompress')
const pack = require('./pack')

const fsp = BbPromise.promisifyAll(fse)

describe('#pack()', () => {
  let tempPath
  let packagePath

  beforeEach(async () => {
    packagePath = path.join(os.tmpdir(), crypto.randomBytes(6).toString('hex'))
    tempPath = path.join(os.tmpdir(), crypto.randomBytes(6).toString('hex'))
    await fsp.ensureDirAsync(packagePath)
    await fsp.ensureDirAsync(tempPath)
    await fsp.writeJsonAsync(path.join(packagePath, 'foo.json'), {
      key1: 'value1',
      key2: 'value2'
    })
  })

  it('should zip the aws-lambda component and return the zip file content', async () => {
    const zipRes = await pack(packagePath, tempPath)
    const unzipRes = await decompress(zipRes)
    const files = unzipRes.map((entry) => ({
      name: entry.path.split(path.sep).pop(),
      content: entry.data
    }))
    const jsonFile = files.filter((file) => file.name === 'foo.json').pop()

    expect(files.length).toEqual(1)
    expect(JSON.parse(jsonFile.content.toString('utf8'))).toEqual({
      key1: 'value1',
      key2: 'value2'
    })
  })
})
