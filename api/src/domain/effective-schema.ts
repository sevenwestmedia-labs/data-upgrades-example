import { DataUpgrade, Schema_Shape } from 'data-upgrades/types'
import { upgradeApplied, addAppliedUpgrades } from 'data-upgrades/applied-upgrades-utils'

export interface EffectiveSchema<Schema extends Schema_Shape, TableNames extends string, Services extends {} = {}> {
    current: Schema
    original: Schema
    update: (updates: Partial<Schema>) => void
    applyUpgrades: (...upgrades: Array<DataUpgrade<Schema, TableNames, Services>>) => void
}

export function createEffectiveSchema<Schema extends Schema_Shape, TableNames extends string, Services extends {} = {}>(
    schema: Schema,
    services: Services,
): EffectiveSchema<Schema, TableNames, Services> {
    let updates: Partial<Schema>

    return {
        get current() {
            return {
                ...schema,
                ...(updates || {}),
            }
        },
        get original() {
            return { ...schema }
        },
        update(update) {
            updates = updates ? { ...updates, ...update } : update
        },
        applyUpgrades(...upgrades) {
            for (const upgrade of upgrades) {
                if (upgrade.upgrade && !upgradeApplied(this.current, upgrade.upgradeName)) {
                    const updated = upgrade.upgrade(this.current, services) || {}

                    updates = {
                        ...(updates || {}),
                        ...updated,
                        applied_upgrades: addAppliedUpgrades(this.current.applied_upgrades || [], upgrade.upgradeName),
                    }
                }
            }
        },
    }
}
