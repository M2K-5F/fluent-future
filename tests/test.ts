// future.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Future, Resolve, Reject } from '../src/index';

describe('Future static methods', () => {
    describe('Future.of', () => {
        it('should create Future from value', async () => {
            const future = Future.of(42);
            assert.strictEqual(await future, 42);
            assert.strictEqual(await future.isOk(), true);
        });

        it('should create Future from Promise', async () => {
            const future = Future.of(Promise.resolve(42));
            assert.strictEqual(await future, 42);
        });

        it('should create Future from function', async () => {
            const future = Future.of(() => 42);
            assert.strictEqual(await future, 42);
        });

        it('should create Future from async function', async () => {
            const future = Future.of(async () => {
                await Promise.resolve();
                return 42;
            });
            assert.strictEqual(await future, 42);
        });

        it('should catch rejected Promise', async () => {
            const error = new Error('Test error');
            const future = Future.of(Promise.reject(error));
            
            assert.strictEqual(await future.isErr(), true);
            await assert.rejects(future.unwrap(), /Test error/);
        });

        it('should catch thrown error from function', async () => {
            const error = new Error('Test error');
            const future = Future.of(() => { throw error; });
            
            assert.strictEqual(await future.isErr(), true);
            await assert.rejects(future.unwrap(), /Test error/);
        });

        it('should apply errorTransformer', async () => {
            const future = Future.of(
                Promise.reject(new Error('Original')),
                (err) => `Transformed: ${err.message}`
            );
            
            assert.strictEqual(await future.isErr(), true);
            await assert.rejects(future.unwrap(), /Transformed: Original/);
        });
    });

    describe('Resolve', () => {
        it('should create successful Future with value', async () => {
            const future = Resolve(42);
            assert.strictEqual(await future.unwrap(), 42);
        });

        it('should create successful Future with Promise', async () => {
            const future = Resolve(Promise.resolve(42));
            assert.strictEqual(await future.unwrap(), 42);
        });

        it('should create void Future without arguments', async () => {
            const future = Resolve();
            assert.strictEqual(await future.unwrap(), undefined);
        });
    });

    describe('Reject', () => {
        it('should create failed Future with error', async () => {
            const error = new Error('Test error');
            const future = Reject(error);
            
            assert.strictEqual(await future.isErr(), true);
            await assert.rejects(future.unwrap(), /Test error/);
        });

        it('should create failed Future with Promise error', async () => {
            const error = new Error('Test error');
            const future = Reject(Promise.resolve(error));
            
            assert.strictEqual(await future.isErr(), true);
            await assert.rejects(future.unwrap(), /Test error/);
        });
    });

    describe('Future.Begin', () => {
        it('should create void Future', async () => {
            const future = Future.Begin();
            assert.strictEqual(await future.unwrap(), undefined);
            assert.strictEqual(await future.isOk(), true);
        });

        it('should allow chaining', async () => {
            const result = await Future.Begin()
                .andThen(() => Future.of(1))
                .andThen(x => Future.of(x + 2))
                .unwrap();
            
            assert.strictEqual(result, 3);
        });
    });

    describe('Future.all', () => {
        it('should resolve all Futures', async () => {
            const futures = [
                Future.of(1),
                Future.of(2),
                Future.of(3)
            ];
            
            const result = await Future.all(futures).unwrap();
            assert.deepStrictEqual(result, [1, 2, 3]);
        });

        it('should reject if any Future fails', async () => {
            const error = new Error('Failed');
            const futures = [
                Future.of(1),
                Future.of(Promise.reject(error)),
                Future.of(3)
            ];
            
            const future = Future.all(futures);
            assert.strictEqual(await future.isErr(), true);
            await assert.rejects(future.unwrap(), /Failed/);
        });

        it('should work with empty array', async () => {
            const result = await Future.all([]).unwrap();
            assert.deepStrictEqual(result, []);
        });

        it('should preserve error type', async () => {
            class CustomError extends Error {
                name = 'CustomError';
            }
            
            const error = new CustomError('Custom');
            const futures = [Future.of(Promise.reject(error))];
            
            const future = Future.all(futures);
            await assert.rejects(future.unwrap(), (err: CustomError) => {
                assert.strictEqual(err.name, 'CustomError');
                return true;
            });
        });
    });

    describe('Future.any', () => {
        it('should resolve first successful Future', async () => {
            const futures = [
                Future.of(Promise.reject(new Error('Fail 1'))),
                Future.of(42),
                Future.of(100)
            ];
            
            const result = await Future.any(futures).unwrap();
            assert.strictEqual(result, 42);
        });

        it('should reject if all fail', async () => {
            const futures = [
                Future.of(Promise.reject(new Error('Fail 1'))),
                Future.of(Promise.reject(new Error('Fail 2')))
            ];
            
            const future = Future.any(futures);
            
            try {
                await future.unwrap();
                assert.fail('Expected to reject');
            } catch (err: any) {
                assert.strictEqual(err.name, 'AggregateError');
                assert.strictEqual(err.errors.length, 2);
                assert.strictEqual(err.errors[0].message, 'Fail 1');
                assert.strictEqual(err.errors[1].message, 'Fail 2');
            }
            
            assert.strictEqual(await future.isErr(), true);
        });
    });

    describe('Future.race', () => {
        it('should resolve with fastest successful', async () => {
            const slow = new Promise<number>(resolve => setTimeout(() => resolve(100), 100));
            const fast = Promise.resolve(42);
            
            const future = Future.race([
                Future.of(slow),
                Future.of(fast)
            ]);
            
            assert.strictEqual(await future.unwrap(), 42);
        });

        it('should reject with fastest error', async () => {
            const slowSuccess = new Promise<number>(resolve => setTimeout(() => resolve(100), 100));
            const fastError = Promise.reject(new Error('Fast error'));
            
            const future = Future.race([
                Future.of(slowSuccess),
                Future.of(fastError)
            ]);
            
            assert.strictEqual(await future.isErr(), true);
            await assert.rejects(future.unwrap(), /Fast error/);
        });
    });

    describe('Edge cases', () => {
        it('should handle nested Futures in all', async () => {
            const futures = [
                Future.of(1).map(x => x * 2),
                Future.of(2).map(x => x * 3),
            ];
            
            const result = await Future.all(futures).unwrap();
            assert.deepStrictEqual(result, [2, 6]);
        });

        it('should handle mixed success/failure in any', async () => {
            const futures = [
                Future.of(Promise.reject(new Error('Fail'))),
                Future.of(42)
            ];
            
            const result = await Future.any(futures).unwrap();
            assert.strictEqual(result, 42);
        });
    });
});