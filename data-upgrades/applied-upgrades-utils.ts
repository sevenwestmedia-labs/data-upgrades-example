export function addAppliedUpgrades(appliedUpgrades: string[] | null, upgradeName: string) {
    if (appliedUpgrades) {
        if (appliedUpgrades.includes(upgradeName)) {
            return appliedUpgrades
        }

        return [...appliedUpgrades, upgradeName]
    }

    return [upgradeName]
}

export function upgradeApplied(
    schema: { applied_upgrades: string[] | null },
    upgradeName: string
): boolean {
    return !!schema.applied_upgrades && schema.applied_upgrades.includes(upgradeName)
}
