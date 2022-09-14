import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useSelector, shallowEqual } from 'react-redux'
import _ from 'lodash'
import moment from 'moment'

import CosmosMetrics from './cosmos-metrics'
import NetworkGraph from './network-graph'
import CrossChainMetrics from './cross-chain-metrics'
import Blocks from '../blocks'
import Transactions from '../transactions'
import { inflation } from '../../lib/api/inflation'
import { transfers_stats } from '../../lib/api/transfer'
import { stats as GMPStats } from '../../lib/api/gmp'
import { getChain } from '../../lib/object/chain'
import { assetManager } from '../../lib/object/asset'

export default () => {
  const {
    preferences,
    evm_chains,
    cosmos_chains,
    assets,
    status,
    chain,
    validators,
  } = useSelector(state =>
    (
      {
        preferences: state.preferences,
        evm_chains: state.evm_chains,
        cosmos_chains: state.cosmos_chains,
        assets: state.assets,
        status: state.status,
        chain: state.chain,
        validators: state.validators,
      }
    ),
    shallowEqual,
  )
  const {
    theme,
  } = { ...preferences }
  const {
    evm_chains_data,
  } = { ...evm_chains }
  const {
    cosmos_chains_data,
  } = { ...cosmos_chains }
  const {
    assets_data,
  } = { ...assets }
  const {
    status_data,
  } = { ...status }
  const {
    chain_data,
  } = { ...chain }
  const {
    validators_data,
  } = { ...validators }

  const [cosmosMetrics, setCosmosMetrics] = useState(null)
  const [crossChainMetrics, setCrossChainMetrics] = useState(null)
  const [transfers, setTransfers] = useState(null)
  const [gmps, setGmps] = useState(null)

  useEffect(() => {
    const getData = async () => {
      if (
        assets_data &&
        status_data &&
        chain_data
      ) {
        const {
          staking_pool,
          voting_power,
          staking_params,
          bank_supply,
        } = { ...chain_data }
        const {
          bonded_tokens,
        } = { ...staking_pool }
        const {
          bond_denom,
        } = { ...staking_params }
        const {
          amount,
        } = { ...bank_supply }
        const {
          latest_block_height,
          latest_block_time,
          avg_block_time,
        } = { ...status_data }

        setCosmosMetrics({
          latest_block_height,
          latest_block_time: moment(latest_block_time).valueOf(),
          avg_block_time,
          active_validators: validators_data?.filter(v => ['BOND_STATUS_BONDED'].includes(v?.status)).length,
          total_validators: validators_data?.length,
          denom: assetManager.symbol(
            bond_denom,
            assets_data,
          ),
          online_voting_power: staking_pool &&
            Math.floor(bonded_tokens),
          online_voting_power_percentage: staking_pool &&
            amount &&
            (
              Math.floor(bonded_tokens) * 100 /
              amount
            ),
          total_voting_power: bank_supply &&
            amount,
          inflation_data: await inflation(),
        })
      }
    }

    getData()
  }, [assets_data, status_data, chain_data, validators_data])

  useEffect(() => {
    const getData = async () => {
      if (
        process.env.NEXT_PUBLIC_SUPPORT_TRANSFERS === 'true' &&
        evm_chains_data &&
        cosmos_chains_data
      ) {
        const chains_data = _.concat(
          evm_chains_data,
          cosmos_chains_data,
        )

        const response = await transfers_stats()

        const {
          data,
        } = { ...response }

        setTransfers({
          num_txs: _.sumBy(
            data,
            'num_txs',
          ),
          volume: _.sumBy(
            data,
            'volume',
          ),
          num_chains: chains_data.length,
          network_graph_data: _.orderBy(
            Object.entries(
              _.groupBy(
                (data || [])
                  .filter(d => d?.id)
                  .map(d => {
                    const {
                      id,
                    } = { ...d }

                    return {
                      ...d,
                      _id: _.slice(
                        id.split('_'),
                        0,
                        -1,
                      ).join('_'),
                    }
                  }),
                '_id',
              )
            )
            .map(([k, v]) => {
              const [
                source_chain,
                destination_chain,
              ] = k.split('_')

              return {
                id: k,
                num_txs: _.sumBy(
                  v,
                  'num_txs',
                ),
                volume: _.sumBy(
                  v,
                  'volume',
                ),
                source_chain,
                destination_chain,
                source_chain_data: getChain(
                  source_chain,
                  chains_data,
                  true,
                ),
                destination_chain_data: getChain(
                  destination_chain,
                  chains_data,
                  true,
                ),
              }
            })
            .filter(d =>
              d.source_chain_data &&
              d.destination_chain_data
            ),
            ['num_txs'],
            ['desc'],
          ),
        })
      }
    }

    getData()

    const interval = setInterval(() =>
      getData(),
      1 * 60 * 1000,
    )

    return () => clearInterval(interval)
  }, [evm_chains_data, cosmos_chains_data])

  useEffect(() => {
    const getData = async () => {
      if (
        process.env.NEXT_PUBLIC_SUPPORT_GMP === 'true' &&
        evm_chains_data &&
        cosmos_chains_data
      ) {
        const chains_data = _.concat(
          evm_chains_data,
          cosmos_chains_data,
        )

        const response = await GMPStats()

        const {
          messages,
        } = { ...response }

        setGmps({
          num_txs: _.sumBy(
            messages,
            'num_txs',
          ),
          num_contracts: _.uniqBy(
            (messages || [])
              .flatMap(m => {
                const {
                  source_chains,
                } = { ...m }

                return (source_chains || [])
                  .flatMap(s => {
                    const {
                      destination_chains,
                    } = { ...s }

                    return (destination_chains || [])
                      .flatMap(d => {
                        const {
                          contracts,
                        } = { ...d }

                        return (contracts || [])
                          .map(c => {
                            const {
                              key,
                              num_txs,
                            } = { ...c }

                            return {
                              id: `${d.key}_${key}`,
                              num_txs,
                            }
                          })
                      })
                  })
              }),
            'id',
          ).length,
          network_graph_data: _.orderBy(
            (messages || [])
              .flatMap(m => {
                const {
                  source_chains,
                } = { ...m }

                return (source_chains || [])
                  .flatMap(s => {
                    const {
                      destination_chains,
                    } = { ...s }

                    return (destination_chains || [])
                      .map(d => {
                        const {
                          key,
                          num_txs,
                        } = { ...d }

                        return {
                          id: `${s.key}_${key}`,
                          num_txs,
                          source_chain: s.key,
                          destination_chain: key,
                          source_chain_data: getChain(
                            s.key,
                            chains_data,
                            true,
                          ),
                          destination_chain_data: getChain(
                            key,
                            chains_data,
                            true,
                          ),
                        }
                      })
                      .filter(d =>
                        d.source_chain_data &&
                        d.destination_chain_data
                      )
                  })
              }),
            ['num_txs'],
            ['desc'],
          ),
        })
      }
    }

    getData()

    const interval = setInterval(() =>
      getData(),
      1 * 60 * 1000,
    )

    return () => clearInterval(interval)
  }, [evm_chains_data, cosmos_chains_data])

  const support_cross_chain =
    process.env.NEXT_PUBLIC_SUPPORT_TRANSFERS === 'true' ||
    process.env.NEXT_PUBLIC_SUPPORT_GMP === 'true'

  return (
    <div className="space-y-8 mb-2 mx-auto pb-12">
      <CosmosMetrics
        data={cosmosMetrics}
      />
      {support_cross_chain && (
        <div className="space-y-3">
          <div className="sm:flex items-center justify-between space-y-1.5 sm:space-y-0 sm:space-x-3">
            <Link href="/transfers">
              <a>
                <h2 className="uppercase tracking-wider text-base font-medium">
                  Axelar Cross-Chain Activities
                </h2>
              </a>
            </Link>
            {['mainnet'].includes(process.env.NEXT_PUBLIC_ENVIRONMENT) && (
              <div className="max-w-min bg-red-100 dark:bg-red-800 rounded whitespace-nowrap text-red-500 dark:text-red-400 text-xs py-0.5 px-2">
                The transfer volume is missing. It will be updated soon.
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <CrossChainMetrics
              transfers={transfers}
              gmps={gmps}
            />
            <div className="lg:col-span-2 xl:col-span-3">
              <NetworkGraph
                id="cross-chain"
                transfers={transfers?.network_graph_data}
                gmps={gmps?.network_graph_data}
              />
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Link href="/blocks">
            <a>
              <h2 className="uppercase tracking-wider text-base font-medium">
                Latest blocks
              </h2>
            </a>
          </Link>
          <Blocks
            n={10}
          />
        </div>
        <div className="space-y-2">
          <Link href="/transactions">
            <a>
              <h2 className="uppercase tracking-wider text-base font-medium">
                Latest transactions
              </h2>
            </a>
          </Link>
          <Transactions
            n={10}
          />
        </div>
      </div>
    </div>
  )
}