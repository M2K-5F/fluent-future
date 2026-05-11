export type FutureType<T, E = Error> = 
    | { ok: true; value: T }
    | { ok: false; error: E }


export class Future<T, E = Error> {
    readonly [Symbol.toStringTag] = 'Future'
    
    constructor(private readonly Future: Promise<FutureType<T, E>>) {}

    /**
     * Checks if the Future succeeded.
     * 
     * @returns `true` if succeeded, `false` if failed
     * 
     * @example
     * ```ts
     * const future = Resolve(69)
     * console.log(await future.isOk()) // true
     * ```
     */
    async isOk(): Promise<boolean> {
        const res = await this.Future
        return res.ok
    }


    /**
     * Checks if the Future failed.
     * 
     * @returns `true` if failed, `false` if succeeded
     * 
     * @example
     * ```ts
     * const future = Reject(new Error('fail'))
     * console.log(await future.isErr()) // true
     * ```
     */
    async isErr(): Promise<boolean> {
        const res = await this.Future
        return !res.ok
    }


    /**
     * Extracts the success value, throwing the error if failed.
     * 
     * @returns The success value
     * @throws The error if the Future failed
     * 
     * @example
     * ```ts
     * const value = await Resolve(69).unwrap() // 69
     * ```
     */
    async unwrap(): Promise<T> {
        const res = await this.Future
        if (!res.ok) throw res.error
        return res.value
    }


    /**
     * Extracts the success value or returns a default value.
     * 
     * @param defaultValue - Value to return if the Future failed
     * @returns The success value or default
     * 
     * @example
     * ```ts
     * const value = await Reject(new Error()).unwrapOr(0) // 0
     * ```
     */
    async unwrapOr(defaultValue: T): Promise<T> {
        const res = await this.Future
        return res.ok ? res.value : defaultValue
    }


    /**
     * Extracts the success value or computes a default from the error.
     * 
     * @param fn - Function to compute a default value from the error
     * @returns The success value or computed default
     * 
     * @example
     * ```ts
     * const value = await Reject(new Error('404'))
     *   .unwrapOrElse(err => err.message.length) // 3
     * ```
     */
    async unwrapOrElse(fn: (error: E) => T): Promise<T> {
        const res = await this.Future
        return res.ok ? res.value : fn(res.error)
    }


    /**
     * Extracts the success value with a custom error message.
     * 
     * @param message - Custom error message prefix
     * @returns The success value
     * @throws Error with custom message if the Future failed
     * 
     * @example
     * ```ts
     * await Reject(new Error('fail')).expect('Failed to load user')
     * ```
     */
    async expect(message: string): Promise<T> {
        const res = await this.Future
        if (!res.ok) {
            throw new Error(`${message}: ${res.error}`)
        }
        return res.value
    }


    /**
     * Transforms the success value.
     * 
     * @param fn - Mapping function
     * @returns A new `Future` with mapped value
     * 
     * @example
     * Future.of(5)
     *   .map(x => x * 2)
     *   .unwrap() // 10
     */
    map<U>(fn: (value: T) => U) {
        const newPromise = this.Future.then(res => 
            res.ok ? { ok: true, value: fn(res.value) } as const : res
        )
        return new Future(newPromise)
    }


    /**
     * Transforms the error value.
     * 
     * @param fn - Error mapping function
     * @returns A new `Future` with the mapped error type
     * 
     * @example
     * ```ts
     * const future = Reject(new Error('original'))
     *   .mapErr(err => new ApiError(err.message))
     * ```
     */
    mapErr<U>(fn: (value: E) => U): Future<T, U> {
        const newPromise = this.Future.then(res => 
            !res.ok ? { ok: false, error: fn(res.error) } as const : res
        )
        return new Future(newPromise)
    }


    /**
     * Chains another `Future` operation.
     * Use when the next operation depends on the previous result.
     * 
     * @param fn - Function returning another `Future`
     * @returns A new `Future`
     * 
     * @example
     * Future.of(5)
     *   .andThen(x => Future.of(x * 2))
     *   .unwrap() // 10
     */
    andThen<U>(fn: (value: T) => Future<U, E>): Future<U, E> {
        const newPromise = this.Future.then(async res => {
            if (!res.ok) return res
            const next = fn(res.value)
            return next.Future
        })
        return new Future(newPromise)
    }


    /**
     * Recovers from an error with another Future.
     * 
     * @param fn - Function that returns a Fallback `Future`
     * @returns A new `Future` that might recover from error
     * 
     * @example
     * ```ts
     * const result = await Reject(new Error('fail'))
     *   .orElse(err => Resolve(0))
     *   .unwrap() // 0
     * ```
     */
    orElse<F>(fn: (error: E) => Future<T, F>): Future<T, F> {
        const newPromise = this.Future.then(async res => {
            if (res.ok) return res
            const next = fn(res.error)
            return next.Future
        })
        return new Future(newPromise)
    }


    /**
     * Executes a side effect on the success value without changing the result.
     * 
     * @param fn - Side effect function
     * @returns The same `Future` unchanged
     * 
     * @example
     * ```ts
     * await Resolve(69)
     *   .tap(x => console.log(x)) // logs 69
     *   .unwrap()
     * ```
     */
    tap(fn: (value: T) => any): Future<T, E> {
        return new Future(this.Future.then(async res => {
            if (res.ok) await fn(res.value)
            
            return res
        }))
    }


    /**
     * Executes a side effect on the error value without changing the result.
     * 
     * @param fn - Side effect function
     * @returns The same `Future` unchanged
     * 
     * @example
     * ```ts
     * await Reject(new Error('fail'))
     *   .tapErr(err => console.error(err)) // logs error
     *   .unwrapOr(0)
     * ```
     */
    tapErr(fn: (error: E) => any): Future<T, E> {
        return new Future(this.Future.then(async res => {
            if (!res.ok) await fn(res.error)
            
            return res
        }))
    }


    /**
     * Pattern-match the result.
     * 
     * @param patterns - Handlers for success and error cases
     * @returns Whatever the handler returns
     * 
     * @example
     * ```ts
     * const message = await Resolve(69).match({
     *   ok: x => `Got ${x}`,
     *   err: e => `Error: ${e}`
     * })
     * ```
     */
    async match<R>(patterns: {
        ok: (value: T) => R
        err: (error: E) => R
    }): Promise<R> {
        const res = await this.Future
        if (res.ok) return patterns.ok(res.value)
        return patterns.err(res.error)
    }


    /**
     * Promise compatibility: extracts the value as a Promise.
     * 
     * @example
     * ```ts
     * const value = await Resolve(69) // 69
     * ```
     */
    then<TFuture1 = T, TFuture2 = never>(
        onfulfilled?: ((value: T) => TFuture1 | PromiseLike<TFuture1>) | null,
        onrejected?: ((reason: any) => TFuture2 | PromiseLike<TFuture2>) | null
    ): Promise<TFuture1 | TFuture2> {
        return this.unwrap().then(onfulfilled, onrejected)
    }


    /**
     * Promise compatibility: catches errors.
     * 
     * @example
     * ```ts
     * const value = await Reject(new Error('fail')).catch(() => 0) // 0
     * ```
     */
    catch<TFuture = never>(
        onrejected?: ((reason: any) => TFuture | PromiseLike<TFuture>) | null
    ): Promise<T | TFuture> {
        return this.unwrap().catch(onrejected)
    }

    /**
     * Creates a `Future` from a value, Promise, or function.
     * 
     * @param input - Value, Promise, or function
     * @param errorTransformer - Optional error transformer
     * @returns A new `Future` instance
     * 
     * @example
     * Future.of(69)
     * Future.of(Promise.resolve(69))
     * Future.of(() => 69)
     */
    static of<T, E = Error>(promise: Promise<T>, errorTransformer?: (error: Error) => E): Future<T, E>
    static of<T, E = Error>(value: T): Future<T, E>
    static of<T, E = Error>(fn: () => T, errorTransformer?: (error: Error) => E): Future<T, E>
    static of<T, E = Error>(
        input: any,
        errorTransformer?: (error: Error) => E
    ): Future<T, E> {
        const promise = (async () => {
            if (typeof input === 'function') return await (input as any)()
            return await input
        })()

        const FuturePromise = promise
            .then(value => ({ ok: true, value } as const))
            .catch(error => ({ 
                ok: false, 
                error: errorTransformer ? errorTransformer(error) : error as E
            } as const))
        
        return new Future(FuturePromise)
    }


    /**
     * Waits for all Futures to complete.
     * 
     * @param futures - Array of Futures
     * @returns A Future with an array of all values
     * 
     * @example
     * ```ts
     * const [user, posts] = await Future.all([api.getUser(), api.getPosts()]).unwrap()
     * ```
     */
    static all<T, E>(futures: NoInfer<Future<T, E>>[]): Future<T[], E> {
        return Future.Begin<E>()
            .andThen(() => {
                const promises = futures.map(f => f.unwrap())
                return Future.of(Promise.all(promises))
            })
    }


    /**
     * Waits for the first successful Future.
     * 
     * @param futures - Array of Futures
     * @returns A Future with the first successful value
     * 
     * @example
     * ```ts
     * const data = await Future.any([api.getCache(), api.getServer()]).unwrap()
     * ```
     */
    static any<T, E>(futures: NoInfer<Future<T, E>>[]): Future<T, E> {
        return Future.Begin<E>()
            .andThen(() => {
                const promises = futures.map(f => f.unwrap())
                return Future.of(Promise.any(promises))
            })
    }


    /**
     * Returns the first Future to complete.
     * 
     * @param futures - Array of Futures
     * @returns A Future with the first result
     * 
     * @example
     * ```ts
     * const result = await Future.race([slow(), fast()]).unwrap()
     * ```
     */
    static race<T, E>(futures: NoInfer<Future<T, E>>[]): Future<T, E> {
        return Future.Begin<E>()
            .andThen(() => {
                const promises = futures.map(f => f.unwrap())
                return Future.of(Promise.race(promises))
            })
    }    


    /**
     * Executes a finalizer regardless of success or failure.
     * 
     * @param fn - Finalizer function
     * @returns The same `Future` unchanged
     * 
     * @example
     * ```ts
     * await Future.of(() => api.call())
     *   .finally(() => setIsLoading(false))
     *   .unwrap()
     * ```
     */
    finally(fn: () => any | Promise<any>): Future<T, E> {
        return new Future(this.Future.then(async res => {
            await fn()
            return res
        }))
    }

    /**
     * Starts a void `Future` chain.
     * Use when you don't have an initial value but need error handling.
     * 
     * @returns A void `Future`
     * 
     * @example
     * Future.Begin<ApiError>()
     *   .andThen(() => api.getUser())
     *   .unwrap()
     */
    static Begin<E = Error>(): Future<void, E> {
        return Resolve<undefined, E>(undefined)
    }
}


/**
 * Creates a successful Future.
 * 
 * @param value - Success value or Promise (optional)
 * @returns A successful Future
 * 
 * @example
 * ```ts
 * Resolve(69)
 * Resolve(Promise.resolve(69))
 * Resolve() // Future<void>
 * ```
 */
export function Resolve<E = Error>(): Future<void, E>
export function Resolve<T, E = Error>(value: T | Promise<T>): Future<T, E>
export function Resolve<T, E = Error>(value?: T | Promise<T>): Future<T | void, E> {
    const val = value !== undefined ? value : (undefined as T)
    const promise = Promise.resolve(val).then(v => ({ ok: true, value: v } as const))
    return new Future(promise)
}


/**
 * Creates a failed Future.
 * 
 * @param error - Error value or Promise
 * @returns A failed Future
 * 
 * @example
 * ```ts
 * Reject(new ApiError(400, 'Bad Request'))
 * Reject(Promise.resolve(new Error('fail')))
 * ```
 */
export const Reject = <E, T = never>(error: E | Promise<E>): Future<T, E> => {
    const promise = Promise.resolve(error).then(e => ({ ok: false, error: e } as const))
    return new Future(promise)
}
