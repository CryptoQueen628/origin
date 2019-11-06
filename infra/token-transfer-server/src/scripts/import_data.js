/*
 Script to import users and grants data into the T3 database.
 Input is a csv file. It is advised to run the script in dry-run mode first
 in order to validate the input data before loading it in the database.

 Usage:
   node import_data.js --filename=<filename>

 Example 1: Validate the data.
   node import_data.js --filename=investors.csv

 Example 2: Import the data in the DB.
   node import_data.js --filename=investors.csv --doIt=true
 */

const assert = require('assert')
const csv = require('csvtojson')
const Logger = require('logplease')
const jwt = require('jsonwebtoken')

const db = require('../models')
const { encryptionSecret, portalUrl } = require('../config')

Logger.setLogLevel(process.env.LOG_LEVEL || 'INFO')
const logger = Logger.create('import_data', { showTimestamp: false })

const employeesVestingInterval = 'months'

const purchaseRounds = ['Advisor', 'Strategic', 'CoinList']

// TODO(franck): Update those values based on final investors vesting schedule.
const investorsVestingStart = new Date('2020/01/01')
const investorsVestingEnd = new Date('2020/12/31')
const investorsVestingCliff = new Date('2020/04/01')
const investorsVestingInterval = 'days'

class CsvFileParser {
  constructor(filename, employee) {
    this.filename = filename
    this.employee = employee
  }

  _checkCells(row) {
    assert(row['Name'] !== undefined)
    assert(row['Email'] !== undefined)
    assert(row['OGN Amount'] !== undefined)
    assert(row['Revised Schedule Agreed At'] !== undefined)
    assert(row['Revised Schedule Rejected'] !== undefined)
    if (this.employee) {
      assert(row['Vesting Start'] !== undefined)
      assert(row['Vesting End'] !== undefined)
      assert(row['Vesting Cliff'] !== undefined)
      assert(row['Vesting Interval'] !== undefined)
    } else {
      assert(row['Purchase Date'] !== undefined)
      assert(row['Purchase Round'] !== undefined)
      assert(row['Investment Amount'] !== undefined)
    }
  }

  async parse() {
    const csvRows = await csv().fromFile(this.filename)

    const emailRegex = /^[a-z0-9-._+]+@[a-z0-9-]+(\.[a-z]+)*(\.[a-z]{2,})$/i
    const dollarAmountRegex = /^\$[0-9,]+(\.[0-9][0-9])?$/

    let lineNum = 1
    const records = []
    for (const row of csvRows) {
      lineNum++
      this._checkCells(row)
      logger.debug(`Line #${lineNum} ${JSON.stringify(row, 2, null)}`)
      const record = {}

      // Parse common fields for both employees and investors
      const name = row['Name'].trim()
      assert(name.length > 0)
      record.name = name

      const email = row['Email'].trim()
      assert(email.length > 0)
      assert(emailRegex.test(email))
      record.email = email

      const amount = Number(row['OGN Amount'].trim().replace(/,/g, ''))
      assert(!Number.isNaN(amount))
      record.amount = amount

      if (row['Revised Schedule Rejected']) {
        record.revisedScheduleRejected = Boolean(
          row['Revised Schedule Rejected']
        )
      }

      if (row['Revised Schedule Agreed At']) {
        record.revisedScheduleAgreedAt = new Date(
          row['Revised Schedule Agreed At']
        )
      }

      if (this.employee) {
        // Parse employee specific fields
        const vestingStart = new Date(row['Vesting Start'])
        assert(vestingStart instanceof Date)
        record.start = vestingStart

        const vestingEnd = new Date(row['Vesting End'])
        assert(vestingEnd instanceof Date)
        assert(vestingEnd > vestingStart)
        record.end = vestingEnd

        const vestingCliff = new Date(row['Vesting Cliff'])
        assert(vestingCliff instanceof Date)
        assert(vestingCliff > vestingStart)
        assert(vestingCliff < vestingEnd)
        record.cliff = vestingCliff

        record.interval = employeesVestingInterval
      } else {
        // Parse investor specific fields
        const purchaseDate = new Date(row['Purchase Date'])
        assert(purchaseDate instanceof Date)
        record.purchaseDate = purchaseDate

        // TODO(franck): this DB field may get renamed.
        const purchaseRound = row['Purchase Round'].trim()
        assert(purchaseRounds.includes(purchaseRound))
        record.purchaseRound = purchaseRound

        // We expect amounts to be formatted as $X.Y
        // For example $123,457.789
        let investmentAmount = row['Investment Amount'].trim()
        assert(dollarAmountRegex.test(investmentAmount))
        investmentAmount = Number(investmentAmount.replace(/[$,]/g, ''))
        assert(!Number.isNaN(investmentAmount))
        record.investmentAmount = investmentAmount

        // Those fields are constant for all investors.
        record.start = investorsVestingStart
        record.end = investorsVestingEnd
        record.cliff = investorsVestingCliff
        record.interval = investorsVestingInterval
      }

      records.push(record)
    }
    logger.info(`Read ${records.length} records from ${this.filename}.`)
    return records
  }
}

class ImportData {
  constructor(config) {
    this.config = config
    this.stats = {
      numUserRowsInserted: 0,
      numGrantRowsInserted: 0
    }
  }

  async process() {
    const parser = new CsvFileParser(this.config.filename, this.config.employee)
    const records = await parser.parse()

    for (const record of records) {
      // Check if user already exists, otherwise create a new user.
      let user
      user = await db.User.findOne({ where: { email: record.email } })
      if (!user) {
        if (this.config.doIt) {
          user = await db.User.create({
            name: record.name,
            email: record.email,
            employee: this.config.employee,
            investorType: record.purchaseRound,
            revisedScheduleAgreedAt: record.revisedScheduleAgreedAt,
            revisedScheduleRejected: record.revisedScheduleRejected
          })
        }

        this.stats.numUserRowsInserted++
      }
      if (this.config.token) {
        logger.info(
          `${record.email} ${portalUrl}/welcome/${generateToken(record.email)}`
        )
      }
      if (this.config.doIt) {
        await db.Grant.create({
          userId: user.id,
          start: record.start,
          end: record.end,
          cliff: record.cliff,
          // Note: Some investors were granted a decimal amount of OGN.
          // We round it up to an integer amount.
          amount: Math.ceil(record.amount),
          interval: record.interval,
          purchaseDate: record.purchaseDate,
          purchaseRound: record.purchaseRound,
          investmentAmount: record.investmentAmount
        })
      }
      this.stats.numGrantRowsInserted++
    }
  }
}

function generateToken(email) {
  return jwt.sign(
    {
      email
    },
    encryptionSecret,
    { expiresIn: '14d' }
  )
}

function parseArgv() {
  const args = {}
  for (const arg of process.argv) {
    const elems = arg.split('=')
    const key = elems[0]
    const val = elems.length > 1 ? elems[1] : true
    args[key] = val
  }
  return args
}

/**
 * MAIN
 */
logger.info('Starting script to import data into T3 DB.')

const args = parseArgv()
const config = {
  filename: args['--filename'],
  // Investor by default.
  employee: args['--employee'] === 'true' || false,
  // Run in in dry-run mode by default.
  doIt: args['--doIt'] === 'true' || false,
  // Generate and print a welcome token
  token: args['--token'] === 'true' || false
}
logger.info('Config:')
logger.info(config)

if (!config.filename) {
  throw new Error('--filename arg missing')
}

const job = new ImportData(config)

job
  .process()
  .then(() => {
    logger.info('================================')
    logger.info('Job stats:')
    logger.info('  Number users inserted:  ', job.stats.numUserRowsInserted)
    logger.info('  Number grants inserted: ', job.stats.numGrantRowsInserted)
    logger.info('Finished')
    process.exit()
  })
  .catch(err => {
    logger.error('Job failed: ', err)
    logger.error('Exiting')
    process.exit(-1)
  })