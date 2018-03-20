![serverless components logo](https://s3.amazonaws.com/assets.github.serverless/serverless-components-readme-2.gif)

## Overview

### Easy 

A Serverless Component can package *cloud/SaaS services*, *logic* & *automation* into a simple building block you can use to build applications more easily than ever.

### Composable 

Serverless Components can be combined & nested. Reuse their functionality to build applications faster.  Combine and nest them to make higher-order components, like features or entire applications.

### Open

Serverless Components are 100% open-source & vendor-agnostic.  You choose the services that best solve your problem, instead of being limited and locked into one platform.

### Serverless

Serverless Components can deploy anything, however they're biased toward SaaS & cloud infrastructure with "serverless" qualities (auto-scaling, pay-per-use, zero-administration), so you can deliver apps with the lowest total cost & overhead.

![serverless components overview](https://s3.amazonaws.com/assets.github.serverless/serverless-components-overview-2.gif)

## Quick Start

**Note:** Make sure you have Node.js 8+ and npm installed on your machine

1. Setup
1. `npm install --global serverless-components`
1. Setup the environment variables
   * `export AWS_ACCESS_KEY_ID=my_access_key_id`
   * `export AWS_SECRET_ACCESS_KEY=my_secret_access_key`

## Table of contents

* [Concepts](#concepts)
  * [Serverless Components](#serverless-components)
  * [Inputs, Outputs & Input Types](#inputs-outputs)
  * [State](#state)
  * [Variables](#variables)
  * [Graph](#graph)
  * [Custom Commands](#custom-commands)
  * [Registry](#registry)
* [Creating components](#creating-components)
  * [Basic setup](#basic-setup)
  * [`serverless.yml`](#serverless.yml)
  * [`index.js`](#index.js)
  * [Testing](#testing)
* [F.A.Q.](#f.a.q.)
* [Components](#components)
  * [apigateway](#apigateway)
  * [dynamodb](#dynamodb)
  * [eventgateway](#eventgateway)
  * [github](#github)
  * [github-webhook-receiver](#github-webhook-receiver)
  * [iam](#iam)
  * [lambda](#lambda)
  * [rest-api](#rest-api)
  * [s3](#s3)
  * [s3-downloader](#s3-downloader)
  * [s3-prototype](#s3-prototype)
  * [s3-uploader](#s3-uploader)

## Concepts

### Serverless Components

A Serverless Component is merely code that provisions a specific outcome, whether that's a low-level piece of infrastructure, a whole feature or an entire application.

Serverless Components are declared by a `serverless.yml` file, which can contain more child Components in a `components` property, like this:

**serverless.yml**

```yml
type: my-component

components:
  usersDatabase:
    type: dynamodb
    inputs:
      name: users-table
```

In the above example, all components defined in `components` will be provisioned automatically by the Serverless Components CLI tool.  This declarative way is the easiest way to create a Serverless Component.

Serverless Components can written declaratively, in code, or both.  If you want your Component to do more advanced provisioning, write some code...




Components always contain provisioning logic, but they can also contain custom logic to help you manage their lifecycle more easily.  If you want your Component to do more, you can include a `index.js` file and start writing some custom logic.

### Inputs & Outputs

#### Inputs

Inputs are the configuration that are supplied to your component logic by the user. You supply those inputs in `serverless.yml`:

```yml
type: some-component

inputTypes:
  firstInput:
    displayName: "The first input"
    type: string
    required: true
    default: 'foo value'

  secondInput: number  # short hand
```

Or, if the component is being used as a child of another parent component, like the `lambda` component, the parent could supply those inputs, and they would overwrite the default inputs that are defined at the child level.

So, if the lambda `serverless.yml` looks like this:

```yml
type: lambda

inputTypes:
  memory:
    displayName: "The amount of memory to provide to the lambda function"
    type: number
    required: true
    default: 128
  timeout:
    displayName: "The timeout of the function in seconds"
    type: number
    required: true
    default: 10
```

a `serverless.yml` which uses lambda could look like this:

```yml
type: my-component

components:
  myFunction:
    type: lambda
    inputs:
      memory: 512
      timeout: 300
```

Then your deployed `lambda` function would have a memory size of 512, and timeout of 300.

#### Outputs

Your provisioning logic, or the `deploy` method of your `index.js` file, can optionally return an outputs object. This output can be referenced in `serverless.yml` as inputs to another component.

For example, the lambda component's deploy method returns outputs that look like this...
**index.js**

```js
const deploy = (inputs, context) => {
  // lambda provisioning logic

  // return outputs
  return {
    arn: res.FunctionArn
  }
}

module.exports = {
  deploy
}
```

These outputs can then be referenced by other components such as in this example we reference the function arn and pass it in to the apigateway component to setup a handler for the route.

```yml
type: my-component

components:
  myFunction:
    type: lambda
    inputs:
      handler: code.handler
  myEndpoint:
    type: apigateway
    inputs:
      routes:
        /github/webhook:
          post:
            lambdaArn: ${myFunction.outputs.arn}
```

### State

State can be accessed at via the `context` object and represents a historical snapshot of what happened last time you ran a command such as `deploy`, `remove`, etc.

The provisioning logic can use this state object and compare it with the current inputs, to make decisions whether to deploy, update, or remove.

The operation that needs to be done depends on the inputs and how the provider works. Change in some inputs for some provider could trigger a create / remove, while other inputs might trigger an update. It's up to the component to decide.

Here's an example on how the lambda component decides what needs to be done based on the inputs and state:

```js
const deploy = (inputs, context) => {
let outputs;
  if (inputs.name && !context.state.name) {
    console.log(`Creating Lambda: ${inputs.name}`);
    outputs = await create(inputs);
  } else if (context.state.name && !inputs.name) {
    console.log(`Removing Lambda: ${context.state.name}`);
    outputs = await remove(context.state.name);
  } else if (inputs.name !== context.state.name) {
    console.log(`Removing Lambda: ${context.state.name}`);
    await remove(context.state.name);
    console.log(`Creating Lambda: ${inputs.name}`);
    outputs = await create(inputs);
  } else {
    console.log(`Updating Lambda: ${inputs.name}`);
    outputs = await update(inputs);
  }
  return outputs;
}

module.exports = {
  deploy
}
```

### Variables

The framework supports variables from two sources:

* **Environment Variables:** for example, `${GITHUB_TOKEN}`
* **Output:** for example: `${myEndpoint.outputs.url}`, where `myEndpoint` is the component alias as defined in `serverless.yml`, and `url` is a property in the outputs object that is returned from the `myEndpoint` provisioning function.

### Graph

When you start composing components together, and each of those components use other nested components, and all those components depend on each other with variable references, you end up with a graph of components.

Internally, the framework constructs this dependency graph by analyzing the entire component structure and their variable references. With this dependency graph the framework is able to provision the required components in parallel whenever they don't depend on each other, while waiting on other components that depend on components that haven't been provisioned yet.

The component author doesn't have to worry about this graph at all. One just uses variables to reference the outputs which should be used and it'll just work.

### Custom Commands

Other than the built in `deploy` and `remove` commands, you can add custom commands to add extra management for your component lifecycle. You do so by adding the corresponding function to the `index.js` file. Just like the other functions in `index.js`, it accepts `inputs`, `state`, `context` and `options`.

```js
const deploy = (inputs, context) => {
  // some provisioning logic
}

const test = (inputs, context) => {
  console.log('Testing the components functionality...')
}

module.exports = {
  deploy,
  test // make the function accessible from the CLI
}
```

### Registry (not yet implemented)

The ["Serverless Registry"](./registry) will be a core part in the implementation since it makes it possible to discover, publish and share existing components. For now, `serverless-components` ships with a number of built in components that are usable by type name.

The registry is not only constrained to serve components. Since components are functions it's possible to wrap existing business logic into functions and publish them to the registry as well.

Looking into the future it could be possible to serve functions which are written in different languages through the registry.


## Creating components

A quick guide to help you build your kick-start component development.

**Note:** Make sure to re-visit the [core concepts](#concepts) above before you jump right into the component implementation.

### Basic setup

In this guide we'll build a simple `greeter` component which will greet us with a custom message when we run the `deploy`, `greet` or `remove` commands.

The first step we need to take is to create a dedicated directory for our component. This directory will include all the necessary files for our component like its `serverless.yml` file, the `index.js` file (which includes the components logic) and files such as `package.json` to define its dependencies.

Go ahead and create a `greeter` directory in the "Serverless Registry" directory located at [`registry`](./registry).

### `serverless.yml`

Let's start by describing our components interface. We define the interface with the help of a `serverless.yml` file. Create this file in the components directory and paste in the following content:

```yml
type: greeter

inputs:
  firstName: John
  lastName: ${LAST_NAME}
```

Let's take a closer look at the code we've just pasted. At first we define the `type` (think of it as an identifier or name) of the component. In our case the component is called `greeter`.

Next up we need to define the `inputs` our component receives. `inputs` are values which are accessible from within the components logic. In our case we expect a `firstName` and a `lastName`. The `firstName` is hardcoded to `John`, whereas the `lastName` is retrieved from an environment variables (the `${}` syntax shows us that we're using [variables](#variables) here).

That's it for the component definition. Let's move on to the implementation of its logic.

### `index.js`

The components logic is implemented with the help of an `index.js` file which is located in the root of the components directory. Go ahead and create an empty `index.js` file in the components root directory.

Next up we'll implement the logic for the `deploy`, `greet` and `remove` commands. We do this by adding the respective functions in the file and exporting them so that the Frameworks CLI can pick them up (_Remember:_ only the exported functions are accessible via CLI commands).

Just paste the following code in the `index.js` file:

```js
// "private" functions
function greetWithFullName(inputs, context) {
  context.log(`Hello ${inputs.firstName} ${inputs.lastName}!`)
}

// "public" functions
function deploy(inputs, context) {
  greetWithFullName(inputs, context)

  if (context.state.deployedAt) {
    context.log(`Last deployment: ${context.state.deployedAt}...`)
  }

  const deployedAt = new Date().toISOString()

  const updatedState = {
    ...context.state,
    ...inputs,
    deployedAt
  }
  context.saveState(updatedState)

  return updatedState
}

function greet(inputs, context) {
  context.log(`Hola ${inputs.firstName} ${inputs.lastName}!`)
}

function remove(inputs, context) {
  greetWithFullName(inputs, context)
  context.log('Removing...')
}

module.exports = {
  deploy,
  greet,
  remove
}
```

Let's take a closer look at the implementation.

Right at the top we've define a "helper" function (this function is not exported at the bottom and can therefore only used internally) we use to reduce code duplication. this `greetWithFullName` function gets the `inputs` and the `context` and logs a message which greets the user with his full name. Note that we're using the `log` function which is available at the `context` object instead of the native `console.log` function. The `context` object has other, very helpful functions and data attached to it.

Next up we've defined the `deploy` function. This function is executed every time the user runs a `deploy` command since we've exported it at the bottom of the file. At first we re-use our `greetWithFullName` function to greet our user. Next up we check the state to see if we've already deployed previously. If that's the case we log out the timestamp of the last deployment. After that we get the current time and store it in an object which includes the `state`, the `inputs` and the new `deployedAt` timestamp. This object reflects our current state which we store. After that we return the object as outputs.

The `greet` function is a custom `command` function we use to extend the CLIs capabilities. Since we've exported it at the bottom of the file it'll be execute every time someone runs the `greet` command. The functionality is pretty straightforward. We just log out a different greeting using the `context.log` method and the `inputs`.

The last function we've defined in our components implementation is the `remove` function. Remove is also accessible from the CLI because we export it at the bottom of the file. The functions code is also pretty easy to understand. At first we greet our user with the `greetWithFullName` helper function. Next up we log a message that the removal was triggered. That's it.

### Testing

Let's test our component!

If we take another look at the `serverless.yml` file we can see that our `lastName` config value depends on a variable called `LAST_NAME` which is fetched from the local environment. This means that we need to export this variable so that the Framework can pick it up and pass it down into our `inputs`:

```sh
export LAST_NAME=Doe
```

Once this is done we can `cd` into our `greeter` directory by running:

```sh
cd registry/greeter
```

Run the following commands to test the components logic:

```
../../bin/serverless deploy

../../bin/serverless deploy

../../bin/serverless greet

../../bin/serverless remove
```

Congratulations! You've successfully created your first Serverless component!

Want to learn more? Make sure to take a look at all the different component implementations in the ["Serverless Registry"](./registry)!

## F.A.Q.
