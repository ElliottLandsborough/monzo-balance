// resources/assets/js/components/Example.js

import React, {Component} from 'react';
import { Link } from 'react-router-dom'
import moment from 'moment'
import GraphAmounts from './GraphAmounts'
import TflAmount from './TflAmount'
import Loader from './Loader'

class Example extends Component {

  /**
   * Constructor
   * @param  {[type]} props [description]
   * @return {[type]}       [description]
   */
  constructor(props) {
    super(props)

    // set the initial state
    this.state = this.initialState();

    // bind 'this' to a few functions
    this.setFromZone = this.setFromZone.bind(this);
    this.setToZone = this.setToZone.bind(this);
    this.logOut = this.logOut.bind(this);
  }

  /**
   * Returns an object of the default state for this component
   * @return {object}
   */
  initialState() {
    return {
      monzoApi: 'https://api.monzo.com', // monzo api url
      error: null, // in case an error happens
      isAuthorized: false, // becomes true if an auth token exists
      accessToken: false, // the access token returned from the api
      accounts: [], // the accounts returned by the api
      accountId: false, // the 'retail_uk' account id
      transactionsForTravel: [], // transactions used for TFL travel
      travelTransactionsLastDate: false, // the date of the most recent transaction
      yearAverages: [], // yearly average monzo spend
      yearTotals: [], // yearly total monzo spend
      yearMonths: [], // monthly total monzo spend
      fromZone: 0, // current 'from' zone from dropdowns
      toZone: 0, // current 'to' zone from dropdowns
      yearlyAmount: 0, // current yearly tfl price based on dropdowns
      clubAmount: 0, // current commuterclub price based on dropdowns
      sinceDate: false, // when to count transactions from
      loadingIsComplete: false, // becomes true when transaction loop finishes
      fullTotal: 0, // all monzo tfl transactions added together
    };
  }

  /**
   * returns the official TFL prices
   * @return {array} zones, weekly, monthly, yearly
   */
  getTflAmounts() {
    // http://content.tfl.gov.uk/adult-fares-2019.pdf
    const amounts = [
      ['1-1', 35.10, 134.80, 1404],
      ['1-2', 35.10, 134.80, 1404],
      ['1-3', 41.20, 158.30, 1648],
      ['1-4', 50.50, 194.00, 2020],
      ['1-5', 60.00, 230.40, 2400],
      ['1-6', 64.20, 246.60, 2568],
      ['1-7', 69.80, 268.10, 2792],
      ['1-8', 82.50, 316.80, 3300],
      ['1-9', 91.50, 351.40, 3660],
      ['2-2', 26.30, 101.00, 1052],
      ['2-3', 26.30, 101.00, 1052],
      ['2-4', 29.10, 111.80, 1164],
      ['2-5', 34.90, 134.10, 1396],
      ['2-6', 43.90, 168.60, 1756],
      ['2-7', 45.60, 175.20, 1824],
      ['2-8', 62.00, 238.10, 2480],
      ['2-9', 62.00, 238.10, 2480],
      ['3-3', 26.30, 101.00, 1052],
      ['3-4', 26.30, 101.00, 1052],
      ['3-5', 29.10, 111.80, 1164],
      ['3-6', 34.90, 134.10, 1396],
      ['3-7', 45.60, 175.20, 1824],
      ['3-8', 62.00, 238.10, 2480],
      ['3-9', 62.00, 238.10, 2480],
      ['4-4', 26.30, 101.00, 1052],
      ['4-5', 26.30, 101.00, 1052],
      ['4-6', 29.10, 111.80, 1164],
      ['4-7', 33.00, 126.80, 1320],
      ['4-8', 55.50, 213.20, 2220],
      ['4-9', 55.50, 213.20, 2220],
      ['5-5', 26.30, 101.00, 1052],
      ['5-6', 26.30, 101.00, 1052],
      ['5-7', 33.00, 126.80, 1320],
      ['5-8', 55.50, 213.20, 2220],
      ['5-9', 55.50, 213.20, 2220],
      ['6-6', 26.30, 101.00, 1052],
      ['6-7', 33.00, 126.80, 1320],
      ['6-8', 55.50, 213.20, 2220],
      ['6-9', 55.50, 213.20, 2220],
      ['7-7', 33.00, 126.80, 1320],
      ['7-8', 55.50, 213.20, 2220],
      ['7-9', 55.50, 213.20, 2220],
      ['8-8', 55.50, 213.20, 2220],
      ['8-9', 55.50, 213.20, 2220],
      ['9-9', 82.80, 318.00, 3312]
    ];

    return amounts;
  }

  /**
   * Returns the price per year based on a start/finish zone
   * @type {Number}
   */
  getYearlyAmount(start = 1, finish = 3)
  {
    // init vars
    let amount = 0, array, amounts = this.getTflAmounts();

    // if start is higher than finish, switch the vars around
    if (start > finish) {
      [start, finish] = [finish, start];
    }

    // search for match
    for (array of amounts) {
      if (array[0] == (start + '-' + finish)) {
        amount = array[3];
      }
    }

    return amount;
  }

  /**
   * Calculate how much commuter club should cost based on a yearly price
   * @type {Number}
   */
  calculateCommuterClub(yearlyAmount)
  {
    // REPRESENTATIVE EXAMPLE: Credit Limit: £1200. Interest: £67 Total payable: £1267 in 11 monthly instalments of £115. Representative 11.61% APR. Interest rate: 5.6% pa
    return ((yearlyAmount / 100 * 5.6) + yearlyAmount);
  }

  /**
   * Runs once the component is initialized
   * @return {[type]} [description]
   */
  componentDidMount() {
    // make sure the state contains the default amounts
    this.setAmounts();

    // initialize auth, get an access token from laravel
    this.initializeAuthentication();
  }

  /**
   * Check if we already have an access token stored in the session.
   * If yes, store in state for later use.
   * @return {[type]} [description]
   */
  initializeAuthentication() {
    fetch("/credentials")
      .then(res => res.json())
      .then(
        (result) => {
          const howManyItems = Object.keys(result).length;
          if (howManyItems) {
            this.setState({
                isAuthorized: true,
                accessToken: result.access_token
            });
          }
          return howManyItems;
        },
        // Note: it's important to handle errors here
        // instead of a catch() block so that we don't swallow
        // exceptions from actual bugs in components.
        (error) => {
          this.setState({
            error
          });
        }
      )
      .then(
        (howManyItems) => {
          if (howManyItems) {
            // If yes, query the api for an account id
            this.fetchAccountId();
          }
        }
      )
  }

  /**
   * Get the account id from the monzo api
   * @return {[type]} [description]
   */
  fetchAccountId() {
    const { monzoApi } = this.state;
    let self = this;
    fetch(monzoApi + '/accounts', this.authParams())
      .then(function(response) {
        if(response.status !== 200) {
          // did not get a 200, log the user out
          // TODO: some kind of error message?
          this.logOut();
        }
        return response;
      })
      .then(res => res.json())
      .then(
        (result) => {
          // success, add accounts to state
          this.setState({
            accounts: result.accounts
          });
        },
        (error) => {
          this.setState({
            error
          });
        }
      )
      .then(
          () => {
            // success, try to extract retail account id
            this.setRetailAccountId();
          }
      )
      .then(
          () => {
            // success, try to get transactions from api
            this.populateTransactions();
          }
      )
  }

  /**
   * Check api response for account that matches 'uk_retail'.
   * Add to state if match exists.
   */
  setRetailAccountId() {
    const { accounts } = this.state;

    accounts.forEach(function(account) {
        if (account.type === 'uk_retail') {
          this.setState({
            accountId: account.id
          });
        }
    }.bind(this));
  }

  /**
   * Returns a url string generated from an object with keys
   * @param  {object} params {var1: string, var2: lol}
   * @return {string}        'var1=string&var2=lol'
   */
  urlEncode(params) {
    var out = [];

    for (var key in params) {
      if (params.hasOwnProperty(key)) {
        out.push(key + '=' + encodeURIComponent(params[key]));
      }
    }

    return out.join('&');
  }

  /**
   * Returns the auth params
   * @param  {String} method Http verb e.g GET/POST
   * @return {Object}        The auth params
   */
  authParams(method = 'GET') {
    const { accessToken } = this.state;
    return {
      method: method,
      headers: {
        'Authorization': 'Bearer ' + accessToken
      }
    }
  }

  /**
   * Set the date to start counting transactions from
   */
  setSinceDate() {
    const since = moment().subtract(12, 'months').format('Y-MM') + '-01T00:00:00Z';
    this.setState({sinceDate: since});
  }

  generateTransactionUrl(since = false) {
    const { monzoApi, accountId } = this.state;

    if (!since) {
        since = this.state.sinceDate;
    }

    let params = {
      // 'expand[]': 'merchant', // this may slow it down?
      'limit': 100,
      'account_id': accountId,
      'since': since,
    };

    return monzoApi + '/transactions?' + this.urlEncode(params);
  }

  /**
   * Calculate how many days between when we started counting from
   * and what date the api has returned (for the progress bar).
   * @return {Number} Between 0 and 100 usually.
   */
  getDaysPercentage()
  {
    // this can only happen if we have both a start date and the api has returned some transactions
    if (this.state.sinceDate !== false && this.state.transactionsForTravel.length) {
        // date we start querying api from
        const fromDate = moment(this.state.sinceDate);
        // now
        const nowDate = moment();
        // last date from list of transactions (string)
        const lastDateString = this.state.transactionsForTravel[this.state.transactionsForTravel.length-1].created;
        // create date object from string
        const lastDate = moment(lastDateString);
        // day count between now and when we started querying the api
        const fromStartUntilNow = moment.duration(nowDate.diff(fromDate)).as('days');
        // day count between when we started querying the api and the last thing the api returned
        const fromstartUntilLast = moment.duration(lastDate.diff(fromDate)).as('days');
        // calc percentage
        const percentage = Math.round(fromstartUntilLast / fromStartUntilNow * 100);

        return percentage;
    }

    return 0;
  }

  /**
   * Find out how much someone spends per month
   * @return {Number} (e.g 92.47)
   */
  getMonzoMonthlyAverage()
  {
    // convert the full total to a positive number of pounds/pence
    const fullTotal = this.state.fullTotal * -1 / 100;
    // only bother if a start date was set and the total is bigger than 0
    if (this.state.sinceDate !== false && fullTotal > 0) {
        // average number of days in a month including leaps
        const daysInMonth = 30.44;
        // date object of start date
        const fromDate = moment(this.state.sinceDate);
        // date object of now
        const nowDate = moment();
        // how many days exist between start and now?
        const fromStartUntilNow = moment.duration(nowDate.diff(fromDate)).as('days');
        // and this equates to how many months (e.g 12.76)
        const exactMonths = fromStartUntilNow / daysInMonth;

        // the total equates to this much per month
        return (fullTotal / exactMonths).toFixed(2);
    }

    return 0;
  }

  // this is a bit weird because we have to call the api once at a time...
  // maybe do it by month instead?
  // TODO: clean this up!!!
  populateTransactions() {
    this.setSinceDate();

    const usedTxKeys = [];

    // get the transactions from localstorage and update state with them
    if (localStorage.getItem('travelTransactions')) {
        const travelTransactionsFromStorage = JSON.parse(localStorage.getItem('travelTransactions'));
        this.setState({
            transactionsForTravel: travelTransactionsFromStorage,
            travelTransactionsLastDate: JSON.parse(localStorage.getItem('travelTransactionsLastDate')),
        });

        travelTransactionsFromStorage.forEach(function(item) {
            usedTxKeys.push(item.id);
        });

        this.travelTotals();
    }

    let self = this;
    // TODO: handle the 401 here, probably clear the credentials
    // and set the state back to isAuthorized: false, clear the old creds
    let transactionsLoop = async function () {
      let continueLoop = true;
      let lastDate = self.state.travelTransactionsLastDate;
      while (continueLoop) {
        const response = await fetch(self.generateTransactionUrl(lastDate), self.authParams());
        const json = await response.json();
        const transactions = json.transactions

        // so just get transport ones
        transactions.forEach(function(transaction) {
            if (transaction.category == 'transport' && transaction.description.toLowerCase().includes('tfl.gov.uk') && transaction.account_id == self.state.accountId) {
                // only write out items that arent already from the localstorage
                if (!usedTxKeys.includes(transaction.id)) {
                    self.setState({
                        transactionsForTravel: [...self.state.transactionsForTravel, ...[{
                            // only take what is needed out of the transaction
                            account_id: transaction.account_id,
                            amount: transaction.amount,
                            created: transaction.created,
                            id: transaction.id
                        }] ]
                    });

                    // store the transactions in the browsers localstorage
                    self.storeTravelTransactions();
                }
            }
        });

        self.travelTotals();

        lastDate = transactions[transactions.length-1].created;

        if (transactions.length < 100) {
          continueLoop = false;
          self.setState({loadingIsComplete: true});
        }
      }
    }

    transactionsLoop();
  }

  /**
   * Store some parts the state in localstorage
   */
  storeTravelTransactions()
  {
    localStorage.setItem('travelTransactions', JSON.stringify(this.state.transactionsForTravel));
    localStorage.setItem('travelTransactionsLastDate', JSON.stringify(this.state.transactionsForTravel[this.state.transactionsForTravel.length-1].created));
  }

  /**
   * Calculate the totals and averages from the transactions in the state
   * @return {[type]} [description]
   */
  travelTotals() {
    // some defaults
    let yearAverages = {};
    let yearTotals = {};
    let yearMonths = {};
    let fullTotal = 0;

    // loop through all transactions
    this.state.transactionsForTravel.forEach(function(transaction) {
      const amount = transaction.amount;
      const month = transaction.created.substr(5,2);
      const year = transaction.created.substr(0,4);

      // total per year, initialize as 0 if it doesnt exist yet
      if (typeof yearTotals[year] == "undefined") yearTotals[year] = 0;
      yearTotals[year] += amount;

      // average per year, initialize as 0 if it doesnt exist yet
      if (typeof yearAverages[year] == "undefined") yearAverages[year] = 0;
      yearAverages[year] += Math.round(amount / 12);

      // total per yearMonth initialize as 0 if it doesnt exist yet
      if (typeof yearMonths['' + year + month] == "undefined") yearMonths['' + year + month] = 0;
      yearMonths['' + year + month] += amount;

      // total of everything
      fullTotal += amount;
    });

    // add all calculations to the state
    this.setState({
        yearAverages: yearAverages,
        yearTotals: yearTotals,
        yearMonths: yearMonths,
        fullTotal: fullTotal,
    });
  }

  // runs whenever 'from' checkbox is changed
  setFromZone(event) {
    this.setAmounts(event.target.value, this.state.toZone);
  }

  // runs whenever 'to' checkbox is changed
  setToZone(event) {
    this.setAmounts(this.state.fromZone, event.target.value);
  }

  /**
   * Set the to/from zones and the yearly tfl/commuterclub prices in the state
   * @param {Number} fromZone [description]
   * @param {Number} toZone   [description]
   */
  setAmounts(fromZone = 1, toZone = 3) {
    const yearlyAmount = this.getYearlyAmount(fromZone, toZone);
    const clubAmount = this.calculateCommuterClub(yearlyAmount);
    this.setState({fromZone: fromZone, toZone: toZone, yearlyAmount: yearlyAmount, clubAmount: clubAmount});
  }

  /**
   * Logs a user out
   * @return {[type]} [description]
   */
  logOut() {
    // async get all logout urls, no need to process response
    fetch(this.state.monzoApi + '/oauth2/logout', this.authParams('POST')); // log out of monzo api
    fetch('/logout'); // log out of laravels everything

    // reset state to initial values
    this.setState(this.initialState());

    // clear localstorage
    //localStorage.setItem('travelTransactions', JSON.stringify([]));
    //localStorage.setItem('travelTransactionsLastDate', JSON.stringify(false));
    localStorage.clear();
  }

  render() {
    const { error, isAuthorized, items, travelTotals } = this.state;

    if (error) {
      return <div>Error: {error.message}</div>;
    } else if (!isAuthorized) {
      return <a className='auth-button' href='/auth'>Authorize with Monzo</a>;
    } else {
      const tflZones = [1,2,3,4,5,6,7,8,9].map((num) =>
        <option key={num} value={num}>{num}</option>
      );
      return (
        <div>
          <Loader daysPercentage={this.getDaysPercentage()} loadingIsComplete={this.state.loadingIsComplete} />
          <GraphAmounts yearlyAmount={this.state.yearlyAmount} clubAmount={this.state.clubAmount} yearMonths={this.state.yearMonths} />
          <div className="zone-selector">
            From zone
            <select id="zoneFromSelector" className="form-control" onChange={this.setFromZone} value={this.state.fromZone}>
              {tflZones}
            </select>
            to zone
            <select id="zoneToSelector" className="form-control" onChange={this.setToZone} value={this.state.toZone}>
              {tflZones}
            </select>
          </div>
          <div className="tfl-amount">
            <TflAmount yearlyAmount={this.state.yearlyAmount} clubAmount={this.state.clubAmount} monzoMonthlyAverage={this.getMonzoMonthlyAverage()} />
          </div>
          <div className="log-out">
            <button className="logout" onClick={this.logOut}>Logout</button>
          </div>
        </div>
      )
    }
  }
}

export default Example;
