import {
  earnOgnEnabled,
  lockupBonusRate,
  otcRequestEnabled,
  unlockDate
} from '@origin/token-transfer-server/src/shared'

let apiUrl
if (process.env.NODE_ENV === 'production') {
  if (window.location.hostname.includes('team')) {
    apiUrl = process.env.TEAM_API_URL
  } else {
    apiUrl = process.env.INVESTOR_API_URL
  }
} else {
  apiUrl = 'http://localhost:5000'
}

let pageTitle
if (window.location.hostname.includes('team')) {
  pageTitle = 'Origin Team Portal'
} else {
  pageTitle = 'Origin Investor Portal'
}

export {
  apiUrl,
  earnOgnEnabled,
  lockupBonusRate,
  otcRequestEnabled,
  pageTitle,
  unlockDate
}
