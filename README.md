# fluent-future

> Type-safe async operations with functional composition. Like `Promise` but with typed errors and monadic methods.

## Features

- ✅ **Type-safe errors** — error type `E` is preserved through the whole chain
- ✅ **Promise-compatible** — works with `await`, `Promise.all`, `Promise.race`
- ✅ **Functional methods** — `map`, `andThen`, `tap`, `orElse`, `finally`
- ✅ **Zero dependencies** — pure TypeScript
- ✅ **Parallel operations** — `all`, `any`, `race`

## Installation

```bash
npm install fluent-future
```

## Quick Start

```ts
import { Future, Resolve, Reject } from 'fluent-future'

// Create from value
const a = Resolve(42)

// Create from Promise
const b = Resolve(fetch('/api/user'))

// Create from function
const c = Future.of(() => JSON.parse('{"x":1}'))

// Chain operations
const result = await Future.Begin<ApiError>()
    .andThen(() => api.getUser())
    .tap(user => console.log(user))
    .map(user => user.name)
    .unwrap()
```

## API

### Construction

| Method | Description |
|--------|-------------|
| `Resolve(value?)` | Creates successful Future |
| `Reject(error)` | Creates failed Future |
| `Future.of(value)` | Creates Future from any input |
| `Future.Begin()` | Starts void chain |

### Instance Methods

| Method | Description |
|--------|-------------|
| `.map(fn)` | Transforms success value |
| `.andThen(fn)` | Chains another async operation |
| `.tap(fn)` | Side effect on success |
| `.tapErr(fn)` | Side effect on error |
| `.orElse(fn)` | Recovers from error |
| `.finally(fn)` | Runs always |
| `.unwrap()` | Extracts value (throws on error) |
| `.unwrapOr(default)` | Extracts value or default |
| `.match(patterns)` | Pattern matching |

### Static Methods

| Method | Description |
|--------|-------------|
| `Future.all([...])` | Waits for all Futures |
| `Future.any([...])` | First successful Future |
| `Future.race([...])` | First completed Future |

## Example

```ts
const user = await Future.Begin<ApiError>()
    .andThen(() => api.login({ email, password }))
    .tap(({ token }) => localStorage.setItem('token', token))
    .andThen(() => api.getProfile())
    .tapErr(err => notifyError(err.message))
    .finally(() => setIsLoading(false))
    .unwrap()
```
