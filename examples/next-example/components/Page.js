import React, { PropTypes } from 'react'
import { inject, observer } from 'mobx-react'
import Link from 'next/link'
import { createAutoSubscriber } from 'firebase-nest'
import RegisterOrLogin from './RegisterOrLogin'
import AddMessage from './AddMessage'
import { limitedMessagesSubs } from '../store'

function deferredUnsubscribe(unsubscribe) {
  //optimization to avoid flickering when paginating - keep current data for a bit while we wait for new query that includes older items
  return () => setTimeout(() => unsubscribe(), 1000);
}

  /* Real-time messages */
@observer
class MessageList extends React.Component {
  static propTypes = {
    store: PropTypes.object.isRequired,
    limitTo: PropTypes.number
  }

  state = {
    fetching: false,
    fetchError: null,
    limitTo: this.props.limitTo || 1,
    prevLimitTo: null
  }

  //used by createAutoSubscriber HOC
  subscribeSubs(subs, props, state) {
    //More advanced version of subscribeSubs with loading indicator and error handling.

    const { store } = this.props

    const {unsubscribe, promise} = store.subscribeSubsWithPromise(subs)

    this.setState({
      fetching: true,
      fetchError: null
    }, () => {
      promise.then(() => {
        this.setState({
          fetching: false
        })
      }, (error) => {
        this.setState({
          fetching: false,
          fetchError: error
        })
      })
    })

    return deferredUnsubscribe(unsubscribe)
  }

  componentDidUpdate() {
    //TODO only do this if we were already at the bottom
    //this.scrollToBottom()
  }

  login = () => {
    const { store } = this.props
    store.signIn({email: 'nyura123@gmail.com', password: 'abc123'})
      .catch((err) => console.error('error signing in: ', err))
  }

  signUp = () => {
    const { store } = this.props
    store.createUser({email: 'nyura123@gmail.com', password: 'abc123'})
      .catch((err) => console.error('error registering: ', err))
  }

  renderMessage(messageKey, messageData) {
    const { store } = this.props
    const user = messageData && messageData.uid ? (store.user(messageData.uid)) : null
    return (
      <div style={{border:'1px grey solid'}} key={messageKey}>
        <div>{messageData.text}</div>
        <div>Posted {new Date(messageData.timestamp).toString()}</div>
        <br />
        <div>User: {JSON.stringify(user)}</div>
        <br />
        <button onClick={() => this.deleteMessage(messageKey)}>Delete</button>
      </div>
    )
  }

  render() {
    const { store, isProtected } = this.props
    const { limitTo } = this.state
    let observableMessages = store.limitedMessages(limitTo)

    //optimization to avoid flickering while paginating - try to get previous subscription's data while we're loading older items
    if (!observableMessages && this.state.prevLimitTo) {
      observableMessages = store.limitedMessages(this.state.prevLimitTo)
    }

    const messages = observableMessages ? observableMessages.entries() : null

    const { fetching, fetchError, error } = this.state

    const isLoggedIn = !!store.authUser()

    return (
      <div>
        <Link href={'/'}><a>Navigate to self - re-render on client</a></Link>
        <br />
        <Link href={'/other'}><a>Navigate to other</a></Link>
        <br />
        <h1><RegisterOrLogin authStore={store} /></h1>
        <br />
        <GetOlder getOlder={this.getOlder} />
        {isProtected && <h3 style={{textAlign:'center'}}>Protected Route</h3>}
        {isProtected && !isLoggedIn && <div>Will not subscribe to data if logged out - see getSubs</div>}
        {fetching && !observableMessages && <div>Fetching</div>}
        {fetchError && <div style={{color:'red'}}>{fetchError}</div>}
        {error && <div style={{color:'red'}}>{error}</div>}
        {!!messages && <div>
          Messages:
          {messages.map(entry => this.renderMessage(entry[0], entry[1]))}
        </div>
        }
        <div style={{float:'left', clear:'both'}} ref={(ref) => { this.messagesEnd = ref }} />

        <div style={{height:40}} />

        <AddMessage />
      </div>
    )
  }

  getOlder = () => {
    this.setState({
      limitTo: this.state.limitTo + 3,
      prevLimitTo: this.state.limitTo
    })
  }

  scrollToBottom = () => {
    this.messagesEnd && this.messagesEnd.scrollIntoView({behavior: "smooth"});
  }

  deleteMessage = (messageKey) => {
    this.setState({error: null}, () => {
      this.props.store.deleteMessage(messageKey)
        .catch((error) => {
          this.setState({error: error.code})
        })
    })
  }
}

const GetOlder = ({getOlder}) => {
  return (
    <button style={{fontSize:'20px'}} onClick={getOlder}>Get More </button>
  )
}

export default inject('store')(createAutoSubscriber({
  getSubs: (props, state) => props.isProtected && !props.store.authUser() ? [] : limitedMessagesSubs(state.limitTo, props.store.fbRef()),
  //subscribeSubs is defined on the component, can also be passed here
})(MessageList))
