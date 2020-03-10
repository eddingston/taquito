import { RpcClient } from '@taquito/rpc';
import { InMemorySigner } from '@taquito/signer';
import { Protocols } from './constants';
import { Config, Context, TaquitoProvider } from './context';
import { ContractProvider, EstimationProvider } from './contract/interface';
import { Forger } from './forger/interface';
import { RpcForger } from './forger/rpc-forger';
import { format } from './format';
import { Signer } from './signer/interface';
import { NoopSigner } from './signer/noop';
import { SubscribeProvider } from './subscribe/interface';
import { PollingSubscribeProvider } from './subscribe/polling-provider';
import { TzProvider } from './tz/interface';
import { WalletProvider } from './wallet/interface';
import { LegacyWallet } from './wallet/legacy';
import { OperationFactory } from './wallet/opreation-factory';


export * from './signer/interface';
export * from './subscribe/interface';
export * from './forger/interface';
export * from './tz/interface';
export * from './constants';
export * from './context';
export { TaquitoProvider } from './context';
export * from './contract';
export * from './contract/big-map';
export * from './forger/interface';
export { OpKind } from './operations/types';
export * from './signer/interface';
export * from './subscribe/interface';
export { SubscribeProvider } from './subscribe/interface';
export { PollingSubscribeProvider } from './subscribe/polling-provider';
export { RpcForger } from './forger/rpc-forger';
export { CompositeForger } from './forger/composite-forger';
export {
  UnitValue,
} from '@taquito/michelson-encoder';

export {
  TezosOperationError,
  TezosOperationErrorWithMessage,
  TezosPreapplyFailureError,
} from './operations/operation-errors';

export * from './tz/interface';
export * from './wallet'

export interface SetProviderOptions {
  forger?: Forger;
  wallet?: WalletProvider;
  rpc?: string | RpcClient;
  stream?: string | SubscribeProvider;
  signer?: Signer;
  protocol?: Protocols;
  config?: Config;
}

/**
 * @description Facade class that surfaces all of the libraries capability and allow it's configuration
 */
export class TezosToolkit {
  private _rpcClient = new RpcClient();
  private _stream!: SubscribeProvider;
  private _options: SetProviderOptions = {};

  private _context: Context = new Context();

  public readonly format = format;

  constructor() {
    this.setProvider({ rpc: this._rpcClient });
  }

  /**
   * @description Sets configuration on the Tezos Taquito instance. Allows user to choose which signer, rpc client, rpc url, forger and so forth
   *
   * @param options rpc url or rpcClient to use to interact with the Tezos network and  url to use to interact with the Tezos network
   *
   * @example Tezos.setProvider({signer: new InMemorySigner(“edsk...”)})
   * @example Tezos.setProvider({config: {confirmationPollingTimeoutSecond: 300}})
   *
   */

  setProvider({ rpc, stream, signer, protocol, config, forger, wallet }: SetProviderOptions) {
    this.setRpcProvider(rpc);
    this.setStreamProvider(stream);
    this.setSignerProvider(signer);
    this.setForgerProvider(forger);
    this.setWalletProvider(wallet);

    this._context.proto = protocol;
    this._context.config = config as Required<Config>;
  }

  private setSignerProvider(signer: SetProviderOptions['signer']) {
    if (!this._options.signer && typeof signer === 'undefined') {
      this._context.signer = new NoopSigner();
      this._options.signer = signer;
    } else if (typeof signer !== 'undefined') {
      this._context.signer = signer;
      this._options.signer = signer;
    }
  }

  private setRpcProvider(rpc: SetProviderOptions['rpc']) {
    if (typeof rpc === 'string') {
      this._rpcClient = new RpcClient(rpc);
    } else if (rpc instanceof RpcClient) {
      this._rpcClient = rpc;
    } else if (this._options.rpc === undefined) {
      this._rpcClient = new RpcClient();
    }
    this._options.rpc = rpc;
    this._context.rpc = this._rpcClient;
  }

  private setForgerProvider(forger: SetProviderOptions['forger']) {
    const f = typeof forger === 'undefined' ? this.getFactory(RpcForger)() : forger;
    this._options.forger = f;
    this._context.forger = f;
  }

  private setWalletProvider(wallet: SetProviderOptions['wallet']) {
    const w = typeof wallet === 'undefined' ? this.getFactory(LegacyWallet)() : wallet;
    this._options.wallet = w;
    this._context.wallet = w;
  }

  private setStreamProvider(stream: SetProviderOptions['stream']) {
    if (typeof stream === 'string') {
      this._stream = new PollingSubscribeProvider(new Context(new RpcClient(stream)));
    } else if (typeof stream !== 'undefined') {
      this._stream = stream;
    } else if (this._options.stream === undefined) {
      this._stream = this.getFactory(PollingSubscribeProvider)();
    }
    this._options.stream = stream;
  }

  /**
   * @description Provide access to tezos account management
   */
  get tz(): TzProvider {
    return this._context.tz;
  }

  /**
   * @description Provide access to smart contract utilities
   */
  get contract(): ContractProvider {
    return this._context.contract;
  }

  get wallet(): WalletProvider {
    return this._context.wallet;
  }

  get operation(): OperationFactory {
    return this._context.operationFactory;
  }

  public batch = this._context.batch.batch.bind(this._context.batch);

  /**
   * @description Provide access to operation estimation utilities
   */
  get estimate(): EstimationProvider {
    return this._context.estimate;
  }

  /**
   * @description Provide access to streaming utilities backed by an streamer implementation
   */
  get stream(): SubscribeProvider {
    return this._stream;
  }

  /**
   * @description Provide access to the currently used rpc client
   */
  get rpc(): RpcClient {
    return this._context.rpc;
  }

  /**
   * @description Provide access to the currently used signer
   */
  get signer() {
    return this._context.signer;
  }

  /**
   *
   * @description Import a key to sign operation
   *
   * @param privateKey Key to load in memory
   * @param passphrase If the key is encrypted passphrase to decrypt it
   */
  importKey(privateKey: string, passphrase?: string): Promise<void>;
  /**
   *
   * @description Import a key using faucet/fundraiser parameter
   *
   * @param email Faucet email
   * @param password Faucet password
   * @param mnemonic Faucet mnemonic
   * @param secret Faucet secret
   */
  // tslint:disable-next-line: unified-signatures
  importKey(email: string, password: string, mnemonic: string, secret: string): Promise<void>;

  async importKey(
    privateKeyOrEmail: string,
    passphrase?: string,
    mnemonic?: string,
    secret?: string
  ): Promise<void> {
    if (privateKeyOrEmail && passphrase && mnemonic && secret) {
      const previousSigner = this.signer;
      const signer = InMemorySigner.fromFundraiser(privateKeyOrEmail, passphrase, mnemonic);
      const pkh = await signer.publicKeyHash();
      this.setSignerProvider(signer);
      try {
        let op;
        try {
          op = await this.tz.activate(pkh, secret);
        } catch (ex) {
          const isInvalidActivationError = ex && ex.body && /Invalid activation/.test(ex.body);
          if (!isInvalidActivationError) {
            throw ex;
          }
        }
        if (op) {
          await op.confirmation();
        }
      } catch (ex) {
        // Restore to previous signer in case of error
        this.setSignerProvider(previousSigner);
        throw ex;
      }
    } else {
      // Fallback to regular import
      this.setSignerProvider(new InMemorySigner(privateKeyOrEmail, passphrase));
    }
  }

  getFactory<T, K extends Array<any>>(ctor: TaquitoProvider<T, K>) {
    return (...args: K) => {
      return new ctor(this._context, ...args);
    };
  }
}

/**
 * @description Default Tezos toolkit instance
 */
export const Tezos = new TezosToolkit();
