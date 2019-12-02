import React, { Component } from 'react';
import {SafeAreaView , ScrollView, RefreshControl, StyleSheet, View, Modal, Text, Button, Platform, Alert } from 'react-native';
import firebase from 'react-native-firebase';
import { WebView } from 'react-native-webview';

export default class App extends Component {

  constructor(props) {
    super(props);
 
    this.state = { 
        key : 0,
        ModalVisibleStatus: false, 
        uri : 'http://parajo.kr',
        //uri : 'http://10.96.9.12:8080',
        refreshing : false,
        refreshing_enable : false,
    };
    user = null;
    webview = null;
    fcmToken = null;
  }

  async componentDidMount(){
    this._checkPermission();
    this.createNotificationChannel();
    this._listenForNotifications(); 
  }

  componentWillUnmount() {
    this.notificationOpenedListener();
    this.notificationListener();
  }

  async _checkPermission(){
    const enabled = await firebase.messaging().hasPermission();
    if (enabled) {
      fcmToken = await firebase.messaging().getToken();
        // user has permissions
        console.log('enabled: ',enabled);
        console.log('fcmToken: ',fcmToken);
       
    } else {
        // user doesn't have permission
        this._requestPermission();
    }
  };

  async _requestPermission(){
    firebase.messaging().requestPermission().then(async () => {
      // User has authorised  
      console.log('requestPermission: ');
      fcmToken = await firebase.messaging().getToken();
      console.log('fcmToken: ',fcmToken);
    })
    .catch(error => {
      alert("you can't handle push notification"+error.message);
    });
  };

  //토큰을 서버에 전달
  async _updateTokenToServer(data){
  // console.log('_updateTokenToServer: ',fcmToken);
    
    const option = {
      method: "POST",
      headers: {
        'Accept':  'application/json',
        'Content-Type': 'application/json',
        'Cache': 'no-cache'
      },
      body: JSON.stringify({
        email: data.user.email,
        fcmToken: data.fcmToken
      }),
      credentials: 'include',
    };
    const url = this.state.uri+"/api/saveFBMessagingToken";
    const postResponse = await fetch(url, option);
    const post = await postResponse.json();
    //console.log('result: ',post);
  };

  
  async _listenForNotifications(){
    // onNotificationDisplayed - ios only

    //앱 활성화시 푸쉬메시지 도착
    this.notificationListener = firebase.notifications().onNotification((notification) => {
      //앱활성화시로컬 push 띄우기
      notification.android.setChannelId('reminder'); //미리 만들어진 채널 set
      notification.android.setAutoCancel(true);
      firebase.notifications().displayNotification(notification); //push 알림 보여주기
      
      console.log('onNotification', notification);
    });
    
    //앱이 foreground, background에서 실행 중일때, push 알림을 클릭하여 열 때, 해당 push 알림을 처리하게 됩니다.  
    this.notificationOpenedListener = firebase.notifications().onNotificationOpened((notificationOpen) => { 
      console.log('onNotificationOpened');
      // Get information about the notification that was opened
      const notification = notificationOpen.notification;
      //console.log('notification', notification);
      const type = notification.data.type;
      if(type==='noti'){
        this.redirectPage(notification.data.url);
      }
    });

    //앱이 종료된 상황에서 push 알림을 클릭하여 열 때, 해당 push 알림을 처리하게 됩니다
    const notificationOpen = await firebase.notifications().getInitialNotification();
    if (notificationOpen) {
      console.log('when getInitialNotification');

      const notification = notificationOpen.notification;
      console.log('notification: ', notification);
      const type = notification.data.type;
      
      //알림이면 넘어온 url 로 리다이렉트
      if(type==='noti'){
        //this.redirectPage(notification.data.url);
        this.setState({ uri: this.state.uri+notification.data.url });
      }
    }

  };

  

  //채널생성: 앱활성화시에 푸쉬알림뜨게할라면 해야함
  createNotificationChannel = () => {
    // Build a android notification channel
    const channel = new firebase.notifications.Android.Channel(
      "reminder", // channelId
      "Reminders Channel", // channel name
      firebase.notifications.Android.Importance.High // channel importance
    ).setDescription("Used for getting reminder notification"); // channel description
  
    // Create the android notification channel
    firebase.notifications().android.createChannel(channel);
  };

  //로그인 프로세스 진행
  loginProcess  = (email, password)=>{
    //웹뷰에 자바스크립트 실행명령어 전달
      user={email, password};
    // console.log(obj);
      var user_json = JSON.stringify(user);
      const run = `RNCalllBackLogin('${user_json}')`;
      this.webview.injectJavaScript(run);
  };

  handleWebViewNavigationStateChange = newNavState => {
    // newNavState looks something like this:
    // {
    //   url?: string;
    //   title?: string;
    //   loading?: boolean;
    //   canGoBack?: boolean;
    //   canGoForward?: boolean;
    // }
    // const { url } = newNavState;
    // if (!url) return;

    // console.log('url',url);

    // if (url.includes('login')) {
    //   console.log('로그인이당');
    //   //this.webview.stopLoading();
    //   // open a modal login viewer
    //   //this.showModalMain(true);
    // }
    // redirect somewhere else
    // if (url.includes('google.com')) {
    //   const newURL = 'https://facebook.github.io/react-native/';
    //   const redirectTo = 'window.location = "' + newURL + '"';
    //   this.webview.injectJavaScript(redirectTo);
    // }
  };

  handleDataReceived = event =>{
    // console.log('handleDataReceived data', data);
 
     //console.log('onWebViewMessage', JSON.parse(event.nativeEvent.data))
     let msgData;
     try {
         msgData = JSON.parse(event.nativeEvent.data) || {}
     } catch (error) {
         console.error(error)
         return
     }
     this[msgData.targetFunc].apply(this, [msgData]);
   };

    //웹뷰에서 로그인 성공후 콜백
  loginCallback = msgData => {
    console.log('call loginCallback isSuccessfull: ', msgData.data.isSuccessfull);
    const isSuccessfull = msgData.data.isSuccessfull;
    //로그인 성공시
    if(isSuccessfull){
      //로그인후 토큰 서버에 전달
      const data={};
      //data.user = user;
      data.user = msgData.data.user;
      data.fcmToken = fcmToken;
      try {
        this._updateTokenToServer(data);
      } catch (error) {
        // User has rejected permissions
        alert("you can't handle push notification"+error.message);
      }

      //웹뷰 URL을 처음화면으로 바꿈
      const newURL = this.state.uri;
      const redirectTo = 'window.location = "' + newURL + '"';
      this.webview.injectJavaScript(redirectTo); //js실행
      
      //로그인 모달창 감춤
      //this.showModalMain(false); 
    }else{
      Alert.alert(
        '로그인 실패',
        '아이디 또는 비밀번호가 다릅니다. 다시 시도해 주세요',
        [
          {
            text: '확인',
            onPress: () => console.log('확인 누름'),
            //style: 'cancel',
          },
        ],
        {cancelable: false},
      );
    }
  };

  //알림을 받은 후 웹뷰 url 리다이렉트
  redirectPage = uri => {
    //data내의 url 파라미터를 확인후 해당페이지로 보낸다
    //
    const newURL = uri;
    const redirectTo = 'window.location = "' + newURL + '"';
    this.webview.injectJavaScript(redirectTo); //js실행
  };

  scrollTopCallback = (msgData) => {
    
    scrollTop = (msgData.data.scrollTop == 0)? true : false;
    //console.log('scrollTop is : ', scrollTop);
    this.setState({refreshing_enable : scrollTop});

  }
  
  onRefresh = () => {
    //console.log('onRefresh!');
    this.setState({refreshing : true});
    this.webview.reload();
    
    this.wait(1500).then(() => {
      this.setState({refreshing : false, refreshing_enable : false});
    });
  }

  wait(timeout) {
    return new Promise(resolve => {
      setTimeout(resolve, timeout);
    });
  }

  render() {
    return (
      <SafeAreaView style = {styles.MainContainer}>
        <ScrollView
        contentContainerStyle={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={this.state.refreshing} enabled={this.state.refreshing_enable} onRefresh={this.onRefresh}/>
        }
      >
        { <WebView
          bounces={false}
          enableNavigate={false}
          key={ this.state.key }
          ref={ref => (this.webview = ref)}
          source={{ uri: this.state.uri }}
          onNavigationStateChange={this.handleWebViewNavigationStateChange}
          onMessage={this.handleDataReceived}
       //   injectedJavaScript={this.INJECTED_JAVASCRIPT}
          cacheEnabled={false}
        /> }
        </ScrollView>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create ({
  MainContainer : {
    flex:1,
    // justifyContent: 'center',
    //  alignItems: 'center',
    marginTop: (Platform.OS == 'ios') ? 20 : 0
},
scrollView: {
  flex: 1,
  //backgroundColor: 'pink',
  //alignItems: 'center',
  justifyContent: 'center',
},
})
