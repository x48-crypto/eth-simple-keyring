const assert = require('assert')
const extend = require('xtend')
const Web3 = require('web3')
const web3 = new Web3()
const ethUtil = require('ethereumjs-util')
const SimpleKeyring = require('../')
const sigUtil = require('eth-sig-util')
const TYPE_STR = 'Simple Key Pair'

// Sample account:
const privKeyHex = 'b8a9c05beeedb25df85f8d641538cbffedf67216048de9c678ee26260eb91952'

describe('simple-keyring', () => {

  let keyring
  beforeEach(() => {
    keyring = new SimpleKeyring()
  })

  describe('Keyring.type', () => {
    it('is a class property that returns the type string.', () => {
      const type = SimpleKeyring.type
      assert.equal(type, TYPE_STR)
    })
  })

  describe('#type', () => {
    it('returns the correct value', () => {
      const type = keyring.type
      assert.equal(type, TYPE_STR)
    })
  })

  describe('#serialize empty wallets.', () => {
    it('serializes an empty array', async () => {
      const output = await keyring.serialize()
      assert.deepEqual(output, [])
    })
  })

  describe('#deserialize a private key', () => {
    it('serializes what it deserializes', async () => {
      await keyring.deserialize([privKeyHex])
      assert.equal(keyring.wallets.length, 1, 'has one wallet')
      const serialized = keyring.serialize()
      assert.equal(serialized[0], privKeyHex)
    })
  })

  describe('#signMessage', () => {
    const address = '0x9858e7d8b79fc3e6d989636721584498926da38a'
    const message = '0x879a053d4800c6354e76c7985a865d2922c82fb5b3f4577b2fe08b998954f2e0'
    const privateKey = '0x7dd98753d7b4394095de7d176c58128e2ed6ee600abe97c9f6d9fd65015d9b18'
    const expectedResult = '0x28fcb6768e5110144a55b2e6ce9d1ea5a58103033632d272d2b5cf506906f7941a00b539383fd872109633d8c71c404e13dba87bc84166ee31b0e36061a69e161c'

    it('passes the dennis test', async () => {
      await keyring.deserialize([ privateKey ])
      const result = await keyring.signMessage(address, message)
      assert.equal(result, expectedResult)
    })

    it('reliably can decode messages it signs', async () => {

      const message = 'hello there!'
      const msgHashHex = web3.sha3(message)

      await keyring.deserialize([ privateKey ])
      await keyring.addAccounts(9)
      const addresses = await keyring.getAccounts()
      const signatures = await Promise.all(addresses.map(async (address) => {
        return await keyring.signMessage(address, msgHashHex)
      }))
      signatures.forEach((sgn, index) => {
        const address = addresses[index]

        const r = ethUtil.toBuffer(sgn.slice(0,66))
        const s = ethUtil.toBuffer('0x' + sgn.slice(66,130))
        const v = ethUtil.bufferToInt(ethUtil.toBuffer('0x' + sgn.slice(130,132)))
        const m = ethUtil.toBuffer(msgHashHex)
        const pub = ethUtil.ecrecover(m, v, r, s)
        const adr = '0x' + ethUtil.pubToAddress(pub).toString('hex')

        assert.equal(adr, address, 'recovers address from signature correctly')
      })
    })
  })

  describe('#addAccounts', () => {
    describe('with no arguments', () => {
      it('creates a single wallet', async () => {
        await keyring.addAccounts()
        assert.equal(keyring.wallets.length, 1)
      })
    })

    describe('with a numeric argument', () => {
      it('creates that number of wallets', async () => {
        await keyring.addAccounts(3)
        assert.equal(keyring.wallets.length, 3)
      })
    })
  })

  describe('#getAccounts', () => {
    it('calls getAddress on each wallet', async () => {

      // Push a mock wallet
      const desiredOutput = '0x18a3462427bcc9133bb46e88bcbe39cd7ef0e761'
      keyring.wallets.push({
        getAddress() {
          return ethUtil.toBuffer(desiredOutput)
        }
      })

      const output = await keyring.getAccounts()
      assert.equal(output[0], desiredOutput)
      assert.equal(output.length, 1)
    })
  })

  describe('#signPersonalMessage', () => {
    it('returns the expected value', async () => {
      const address = '0xbe93f9bacbcffc8ee6663f2647917ed7a20a57bb'
      const privateKey = new Buffer('6969696969696969696969696969696969696969696969696969696969696969', 'hex')
      const privKeyHex = ethUtil.bufferToHex(privateKey)
      const message = '0x68656c6c6f20776f726c64'
      const signature = '0xce909e8ea6851bc36c007a0072d0524b07a3ff8d4e623aca4c71ca8e57250c4d0a3fc38fa8fbaaa81ead4b9f6bd03356b6f8bf18bccad167d78891636e1d69561b'

      await keyring.deserialize([privKeyHex])
      const sig = await keyring.signPersonalMessage(address, message)
      assert.equal(sig, signature, 'signature matches')

      const restored = sigUtil.recoverPersonalSignature({
        data: message,
        sig,
      })

      assert.equal(restored, address, 'recovered address')
    })
  })

  describe('#signTypedData', () => {
    const address = '0x29c76e6ad8f28bb1004902578fb108c507be341b'
    const privKeyHex = '0x4af1bceebf7f3634ec3cff8a2c38e51178d5d4ce585c52d6043e5e2cc3418bb0'

    it('returns the expected value', async () => {
      const expectedSignature = '0x49e75d475d767de7fcc67f521e0d86590723d872e6111e51c393e8c1e2f21d032dfaf5833af158915f035db6af4f37bf2d5d29781cd81f28a44c5cb4b9d241531b'

      const typedData = [
          {
              type: 'string',
              name: 'message',
              value: 'Hi, Alice!'
          }
      ]

      await keyring.deserialize([privKeyHex])
      const sig = await keyring.signTypedData(address, typedData)
      assert.equal(sig, expectedSignature, 'signature matches')
      const restored = sigUtil.recoverTypedSignature({ data: typedData, sig: sig })
      assert.equal(restored, address, 'recovered address')
    })
  })
})
