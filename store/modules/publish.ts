import { ActionTree, MutationTree, GetterTree, ActionContext } from 'vuex';
import { RootState } from 'store';

const apiUrl = `${process.env.apiUrl}/manifests`;
const platforms = {
    web: 'web',
    windows10: 'windows10',
    windows: 'windows',
    ios: 'ios',
    android: 'android',
    androidTWA: 'android-twa',
    samsung: 'samsung',
    msteams: 'msteams',
    all: 'All'
};

export const name = 'publish';

export const types = {
    UPDATE_STATUS: 'UPDATE_STATUS',
    UPDATE_ARCHIVELINK: 'UPDATE_ARCHIVELINK',
    UPDATE_APPXLINK: 'UPDATE_APPXLINK',
    UPDATE_DOWNLOAD_DISABLED: "UPDATE_DOWNLOAD_DISABLED"
};

export interface State {
    status: boolean | null;
    archiveLink: string | null;
    appXLink: string | null;
    downloadDisabled: boolean;
}

export interface AppxParams {
    publisher: string | null;
    publisher_id: string | null;
    package: string | null;
    version: string | null;
}

export interface AndroidParams {
    package_name: string | null;
}

export interface TeamsParams {
    name: string | null;
    shortDescription: string | null;
    longDescription: string | null;
    privacyUrl: string | null;
    termsOfUseUrl: string | null;
    colorImageFile:  File | null;
    outlineImageFile:  File | null;
}

export const state = (): State => ({
    status: null,
    archiveLink: null,
    appXLink: null,
    downloadDisabled: false
});

export const getters: GetterTree<State, RootState> = {};

export interface Actions<S, R> extends ActionTree<S, R> {
    resetAppData(context: ActionContext<S, R>): void;
    updateStatus(context: ActionContext<S, R>): void;
    build(context: ActionContext<S, R>, params: { platform: string, href: string, options?: string[]}): Promise<void>;
    buildAppx(context: ActionContext<S, R>, params: AppxParams): Promise<void>;
    buildTeams(context: ActionContext<S, R>, params: { href: string, options?: string[]}): Promise<void>;
    disableDownloadButton(context: ActionContext<S, R>): Promise<void>;
    enableDownloadButton(context: ActionContext<S, R>): Promise<void>;
}

export const actions: Actions<State, RootState> = {

    resetAppData({ dispatch }): void {
        dispatch('generator/resetStates', undefined, { root: true });
        dispatch('serviceworker/resetStates', undefined, { root: true });
    },

    updateStatus({ commit, rootState }): void {
        let status = !!rootState.generator['url'];
        commit(types.UPDATE_STATUS, status);
    },

    async build({ commit, rootState }, params: { platform: string, href: string, options?: string[] }): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const manifestId = rootState.generator.manifestId;
            const serviceworker = rootState.serviceworker.serviceworker;

            if (!manifestId || !serviceworker) {
                reject('error.manifest_required');
            }

            if (!params || !params.platform) {
                reject('error.platform_required');
            }

            let platformsList: string[] = [];
            if (params.platform === platforms.all) {
                platformsList = [ platforms.web, platforms.windows10, platforms.windows, platforms.ios, platforms.android, platforms.androidTWA, platforms.samsung, platforms.msteams ];
            } else {
                platformsList = [ params.platform ];
            }

            try {
                const options = { platforms: platformsList, dirSuffix: params.platform, parameters: params.options };
                const result = await this.$axios.$post(`${apiUrl}/${manifestId}/build?ids=${serviceworker}&href=${params.href}
                `, options);
                commit(types.UPDATE_ARCHIVELINK, result.archive);
                resolve();
            } catch (e) {
                let errorMessage = e.response.data ? e.response.data.error : e.response.data || e.response.statusText;

                reject(errorMessage);
            }
        });
    },

    async buildAppx({ commit, rootState }, params: AppxParams): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const manifestId = rootState.generator.manifestId;

            if (!manifestId) {
                reject('error.manifest_required');
            }

            if (!params.publisher || !params.publisher_id || !params.package || !params.version) {
                reject('error.fields_required');
            }

            try {
                const options = { name: params.publisher, publisher: params.publisher_id, package: params.package, version: params.version };
                const result = await this.$axios.$post(`${apiUrl}/${manifestId}/appx`, options);
                commit(types.UPDATE_APPXLINK, result.archive);
                resolve();
            } catch (e) {
                // Check for common/known errors and simplify message
                let errorMessage = '';
                let error = e.response.data ? e.response.data.error.toString() : e.response.toString();

                if (error.includes(`@Publisher\nPackage creation failed`)) {
                  errorMessage = 'Invalid Publisher Identity.';
                } else if (error.includes(`@Version\nPackage creation failed.`)) {
                  errorMessage = 'Invalid Version Number.';
                } else {
                    errorMessage = 'Package building error.';
                }
                reject(errorMessage);
            }
        });
    },

    async buildTeams({ dispatch, rootState }, params: { href: string, options?: string[] }): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const manifestId = rootState.generator.manifestId;

            if (!manifestId) {
                reject('error.manifest_required');
            }

            const { name, longDescription, shortDescription, privacyUrl, termsOfUseUrl, colorImageFile, outlineImageFile } = JSON.parse(params.options ? params.options[0] : "{}");
            if (!name || !longDescription || !shortDescription || !privacyUrl || !termsOfUseUrl || !colorImageFile || !outlineImageFile) {
                reject('error.fields_required');
            }

            resolve();
        }).then(() => {
            return dispatch("build", { platform: platforms.msteams, href: params.href, options: params.options });
        })
    },

    async disableDownloadButton({commit}): Promise<void> {
        commit(types.UPDATE_DOWNLOAD_DISABLED, true);
    },

    async enableDownloadButton({commit}): Promise<void> {
        commit(types.UPDATE_DOWNLOAD_DISABLED, false);
    }
};

export const mutations: MutationTree<State> = {
    [types.UPDATE_STATUS](state, status: boolean): void {
        state.status = status;
    },
    [types.UPDATE_ARCHIVELINK](state, url: string): void {
        state.archiveLink = url;
    },
    [types.UPDATE_APPXLINK](state, url: string): void {
        state.appXLink = url;
    },
    [types.UPDATE_DOWNLOAD_DISABLED](state, disabled: boolean): void {
        state.downloadDisabled = disabled;
    }
};

