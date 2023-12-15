export const actionTypeKey = 'extension-action-type'

export const actionType = {
    OPEN_TAB: 'open-tab',
    GO_TO_TAB_IF_OPEN: 'go-to-tab-if-open',
    SHOW_POPUP: 'show-popup'
}

export const actionTypeHint = {
    [actionType.OPEN_TAB]: 'Open and go to origin tab, if it is possible',
    [actionType.GO_TO_TAB_IF_OPEN]: 'Go to origin tab only if it\'s open. Otherwise show a popup with origin url.',
    [actionType.SHOW_POPUP]: 'Show a popup with origin url. From there you can decide if you want to open that url.',
}

export const TAB_ORIGIN_DATA_MSG = 'tab-origin-data'

/**
 * Sends message with runtime.sendMessage
 * @param {String} msgType 
 * @param {any} payload 
 * @returns {Promise<any>}	Promise with response if a receiver sent the response
 */
export function sendMessage(msgType, payload) {
    return chrome.runtime.sendMessage({ [msgType]: payload })
}

/**
 * Resolves a promise with "action type" value
 * stored in `storage.local`, if no such value
 * is stored then `OPEN_TAB` value is resolved.
 * @returns {Promise<String>}
 */
export function getActionType() {
    return chrome.storage.local.get(actionTypeKey).then(data => data[actionTypeKey] || actionType.OPEN_TAB)
}

export function focusTab(tabId, windowId) {
    chrome.tabs.update(tabId, { active: true });
    chrome.windows.update(windowId, { focused: true });
}

export function createTab(url, index, historyStack) {
    // createTab() can reject when you try to open
    // privileged urls like "about:config",
    // see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/Tabs/create#url
    return chrome.tabs.create({ url, index })
        .then(newtab => {
            // We don't want to set the last tab to the one we just came
            // from (this one), instead we want to inherit the parent tab
            // stack so we can keep going all the way back.
            chrome.storage.local.set({ [newtab.id.toString()]: historyStack.slice(0, -1) });
        });
}