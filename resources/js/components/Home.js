// resources/assets/js/components/Home.js

import React, {Component} from 'react'
import { Link } from 'react-router-dom'

import Swal from 'sweetalert2'
import dateParse from 'date-fns/parse'
import dateDiffInDays from 'date-fns/difference_in_days'

import Monzo from '../classes/banks/monzo'
import Starling from '../classes/banks/starling'
import Maths from '../classes/maths'
import Storage from '../classes/storage'

import GraphAmounts from './GraphAmounts'
import TflAmount from './TflAmount'
import Loader from './Loader'

class Home extends Component {

  bank = false;
  maths = new Maths;
  storage = new Storage;
  currentBank = false;
  accessToken = false; // the access token returned from the api

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
      error: null, // in case an error happens
      isAuthorized: false, // becomes true if an auth token exists
      transactionsForTravel: [], // transactions used for TFL travel
      //travelTransactionsLastDate: false, // the date of the most recent transaction
      yearAverages: [], // yearly average spend
      yearTotals: [], // yearly total spend
      yearMonths: [], // monthly total spend
      fromZone: 0, // current 'from' zone from dropdowns
      toZone: 0, // current 'to' zone from dropdowns
      yearlyAmount: 0, // current yearly tfl price based on dropdowns
      clubAmount: 0, // current commuterclub price based on dropdowns
      //sinceDate: false, // when to count transactions from
      //loadingIsComplete: false, // becomes true when transaction loop finishes
      fullTotal: 0, // all tfl transactions added together
      //usedTxKeys: [], // transaction ids that have already been grabbed from the api
    };
  }

  /**
   * Runs once the component is initialized
   * @return {[type]} [description]
   */
  componentDidMount() {

    // make sure the state contains the default amounts
    this.setAmounts();

    // initialize auth, get an access token from laravel
    this.startApiProcess();

    let self = this;

    setInterval(function() {
        // of bank was selected and loading has not completed yet
        if (self.bank !== false && self.bank.getLoadingIsComplete() !== true) {
            let transactionsForTravel = self.bank.getTransactionsForTravel();
            //self.setState({transactionsForTravel: transactionsForTravel});
            let sinceDate = self.bank.sinceDate;
            let travelTotals = self.maths.travelTotals(transactionsForTravel, sinceDate);
            self.setState({
                fullTotal:    travelTotals.fullTotal,
                percentage:   travelTotals.percentage,
                yearAverages: travelTotals.yearAverages,
                yearMonths:   travelTotals.yearMonths,
                yearTotals:   travelTotals.yearTotals,
            });

            // starling only needs one iteration
            if (self.currentBank === 'starling') {
                self.bank.loadingIsComplete = true;
            }
        }
    }, 1 * 1000); // first int is seconds
  }

  startApiProcess() {
    let self = this;

    this.initializeAuthenticationWithCallback(function() {
        if (self.currentBank === 'monzo') {
            self.bank = new Monzo();
        }
        if (self.currentBank === 'starling') {
            self.bank = new Starling();
        }
        // query the api for an account id
        self.bank.beginTransactionsProcess(self.accessToken);
    });
  }

  /**
   * Check if we already have an access token stored in the session.
   * If yes, store in state for later use.
   * @return {[type]} [description]
   */
  initializeAuthenticationWithCallback(callback) {
    fetch("/credentials")
      .then(res => res.json())
      .then(
        (result) => {
          const howManyItems = Object.keys(result).length;
          if (howManyItems) {
            this.setState({ isAuthorized: true });
            this.accessToken = result.access_token;
            this.currentBank = result.current_bank;
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
            callback();
          }
        }
      )
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
    const yearlyAmount = this.maths.getYearlyAmount(fromZone, toZone);
    const clubAmount = this.maths.calculateCommuterClub(yearlyAmount);
    this.setState({fromZone: fromZone, toZone: toZone, yearlyAmount: yearlyAmount, clubAmount: clubAmount});
  }

  // log out of laravels everything
  logoutOfLaravel() {
    fetch('/logout');
  }

  // grab the id/secret and use it to generate an auth URL
  authWithUserInput(e) {
    e.preventDefault();
    let url = '';

    (async function getFormValues () {
      const {value: formValues} = await Swal.fire({
        title: 'Access Key Input',
        html:
          '<input id="swal-input1" class="swal2-input" placeholder="Client ID">' +
          '<input id="swal-input2" class="swal2-input" placeholder="Client Secret">' +
          '<a target="_blank" href="/help">help</a>',
        focusConfirm: false,
        preConfirm: () => {
          return [
            document.getElementById('swal-input1').value,
            document.getElementById('swal-input2').value
          ]
        }
      })
      if (formValues[0].length && formValues[1].length) {
        let formData = new FormData();
        formData.append('client_id', formValues[0]);
        formData.append('client_secret', formValues[1]);

        fetch('/auth/monzo', {
          method: 'POST',
          body: formData,
          headers: {
            'X-CSRF-TOKEN' : document.querySelector('meta[name="csrf-token"]').getAttribute('content')
          }
        })
        .then(
          (response) => {
            if(response.status !== 200) {

            }
            return response;
          }
        )
        .then(res => res.json())
        .then(
          (response) => {
            if (typeof response.url !== 'undefined') {
              window.location.href = response.url;
            }
          }
        );
      }
    })()
  }

  /**
   * Logs a user out
   * @return {[type]} [description]
   */
  logOut() {
    // log out of bank
    this.bank.logOut(this.accessToken);
    // log out of laravel
    this.logoutOfLaravel();
    // clear localstorage
    this.storage.logout();
    // reset state to initial values
    this.setState(this.initialState());
  }

  render() {
    const { error, isAuthorized, items, travelTotals } = this.state;

    let monzoButton;
    let starlingButton;

    if (process.env.MIX_MONZO_ENABLE === 'true') {
      monzoButton = <p><a className='auth-button monzo' href='#' onClick={this.authWithUserInput}>Authorize with Monzo</a></p>;
    }

    if (process.env.MIX_STARLING_ENABLE === 'true') {
      starlingButton = <p><a className='auth-button starling' href='/auth/starling'>Authorize with Starling</a></p>;
    }

    if (error) {
      return <div>Error: {error.message}</div>;
    } else if (!isAuthorized) {
      return (
        <div class="guest-container">
          {monzoButton}
          {starlingButton}
          <p>This app makes a graph of your monthly spend on the London transport system. Please authorize to continue.</p>
        </div>
      );
    } else {
      const tflZones = [1,2,3,4,5,6,7,8,9].map((num) =>
        <option key={num} value={num}>{num}</option>
      );

      const monthCount = Object.keys(this.state.yearMonths).length;

      return (
        <div>
          <Loader daysPercentage={this.state.percentage} loadingIsComplete={this.state.loadingIsComplete} />
          <GraphAmounts
            yearlyAmount={this.state.yearlyAmount}
            clubAmount={this.state.clubAmount}
            yearMonths={this.state.yearMonths}
            monthlyAverage={this.maths.getMonthlyAverageFromMonthCount(this.state.fullTotal, monthCount)}
            currentBank={this.currentBank}
          />
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
            <TflAmount
              yearlyAmount={this.state.yearlyAmount}
              clubAmount={this.state.clubAmount}
              monthlyAverage={this.maths.getMonthlyAverageFromMonthCount(this.state.fullTotal, monthCount)}
              fullTotal={this.state.fullTotal}
            />
          </div>
          <div className="log-out">
            <button className={this.currentBank} onClick={this.logOut}>Logout</button>
          </div>
        </div>
      )
    }
  }
}

export default Home;
