# Sample projects for Agora RTC Web SDK 4.x

_English | [简体中文](README.cn.md)_

## Overview

This repository contains sample projects using the Agora RTC Web SDK 4.x.

<hr>

The Web SDK 4.x refactors the Web SDK 3.x. Based on the features of 3.x, 4.x fully optimizes the internal architecture of the SDK and provides more flexible and easy-to-use APIs.

Compared to the Web SDK 3.x, the Web SDK 4.x has the following advantages:

- Uses promises for asynchronous operations, which improves the robustness and readability of your code.
- Supports TypeScript.
- Replaces the Stream object with Track objects for separate and flexible control over audio and video.
- Improves the channel event notification mechanism, making it easier for you to deal with reconnection.
- Provides more accurate and comprehensive error codes for troubleshooting.

## Projects using jQuery and Bootstrap

| Feature                 | Sample project location                                      |
| ----------------------- | ------------------------------------------------------------ |
| Basic Examples          | [/src/example/basic](/src/example/basic)                     |
| Advanced Examples       | [/src/example/advanced](/src/example/advanced)               |
| **Conversation Platform** | [/src/example/advanced/conversationPlatform](/src/example/advanced/conversationPlatform) |
| Plugin Examples         | [/src/example/plugin](/src/example/plugin)                   |
| Other Examples          | [/src/example/others](/src/example/others)                   |
| Vue Framework Example   | [/src/example/framework/vue](/src/example/framework/vue)     |
| React Framework Example | [/src/example/framework/react](/src/example/framework/react) |

### How to run the sample projects

#### Prerequisites

You need a supported browser to run the sample projects. See [Product Overview](https://docs.agora.io/en/Interactive%20Broadcast/product_live?platform=Web#compatibility) for a list of supported browsers.

#### Steps to run

1. In the project root path run the following command to install dependencies.

   ```shell
   npm install
   ```

2. Use the following command to run the sample project.

   ```shell
   npm run dev
   ```

3. Open link [http://localhost:3001/index.html](http://localhost:3001/index.html) in browser.

4. In the demo setting page, enter your App ID and App Certificate, then click SetUp button.
   - See [Get Started with Agora](https://docs.agora.io/en/Agora%20Platform/get_appid_token) to learn how to get an App ID and App Certificate.

## Conversation Platform

The **Conversation Platform** is a sophisticated real-time communication application that allows up to 1000 users to join and have one-on-one conversations.

### Features

- **Multi-User Support**: Up to 1000 users can join the platform simultaneously
- **Manual Conversation Control**: Users manually choose who to talk to
- **Automatic Recording**: Each user's audio is automatically recorded during conversations
- **Local Downloads**: Recordings are automatically downloaded to the user's device
- **Real-Time Status**: Users can see who's available, waiting, or in conversation
- **Cross-Tab Synchronization**: Works across multiple browser tabs/windows

### How to Use

1. **Setup**: Configure your Agora App ID and App Certificate in the setup page
2. **Connect**: Join the conversation platform
3. **Find Partner**: See available users and their status
4. **Start Conversation**: Click "Start Conversation" with an available user
5. **Talk**: Have a real-time conversation
6. **End**: Click "End Conversation" when done
7. **Download**: Recording automatically downloads to your device

### Recording System

- **Format**: WebM audio with Opus codec
- **Storage**: Local downloads only (no server required)
- **Naming**: `user-{UID}-conversation-{conversationId}-{timestamp}.webm`
- **Privacy**: Each user only records their own audio track

### Technical Details

- **Real-time Communication**: Agora RTC Web SDK 4.x
- **Cross-Tab Sync**: localStorage and polling mechanism
- **Audio Recording**: MediaRecorder API
- **File Format**: WebM/Opus for optimal quality and size
- **No Backend Required**: Pure client-side application

## Reference

- [Web SDK 4.x Product Overview](https://docs.agora.io/en/Interactive%20Broadcast/product_live?platform=Web)
- [Web SDK 4.x API Reference](https://docs.agora.io/en/Interactive%20Broadcast/API%20Reference/web_ng/index.html)
- [Online demo deployed from this repo](https://webdemo.agora.io/)

## Feedback

If you have any problems or suggestions regarding the sample projects, feel free to file an issue.

## Related resources

- Check our [FAQ](https://docs.agora.io/en/faq) to see if your issue has been recorded.
- Dive into [Agora SDK Samples](https://github.com/AgoraIO) to see more tutorials
- Take a look at [Agora Use Case](https://github.com/AgoraIO-usecase) for more complicated real use case
- Repositories managed by developer communities can be found at [Agora Community](https://github.com/AgoraIO-Community)
- If you encounter problems during integration, feel free to ask questions in [Stack Overflow](https://stackoverflow.com/questions/tagged/agora.io)

## License

The sample projects are under the MIT license.
