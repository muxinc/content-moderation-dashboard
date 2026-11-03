/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as migrations from "../migrations.js";
import type * as moderation from "../moderation.js";
import type * as moderationActions from "../moderationActions.js";
import type * as muxWebhook from "../muxWebhook.js";
import type * as questions from "../questions.js";
import type * as sessions from "../sessions.js";
import type * as settings from "../settings.js";
import type * as uploads from "../uploads.js";
import type * as videoQueries from "../videoQueries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  migrations: typeof migrations;
  moderation: typeof moderation;
  moderationActions: typeof moderationActions;
  muxWebhook: typeof muxWebhook;
  questions: typeof questions;
  sessions: typeof sessions;
  settings: typeof settings;
  uploads: typeof uploads;
  videoQueries: typeof videoQueries;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  mux: {
    catalog: {
      getAssetByMuxId: FunctionReference<
        "query",
        "internal",
        { muxAssetId: string },
        {
          _creationTime: number;
          _id: string;
          aspectRatio?: string;
          createdAtMs: number;
          deletedAtMs?: number;
          durationSeconds?: number;
          liveStreamId?: string;
          maxStoredFrameRate?: number;
          maxStoredResolution?: string;
          muxAssetId: string;
          passthrough?: string;
          playbackIds?: Array<{ id: string; policy?: string }>;
          raw: Record<string, any>;
          status?: string;
          tracks?: Array<{
            id?: string;
            languageCode?: string;
            name?: string;
            status?: string;
            textType?: string;
            type?: string;
          }>;
          updatedAtMs: number;
          uploadId?: string;
        } | null
      >;
      getLiveStreamByMuxId: FunctionReference<
        "query",
        "internal",
        { muxLiveStreamId: string },
        {
          _creationTime: number;
          _id: string;
          createdAtMs: number;
          deletedAtMs?: number;
          muxLiveStreamId: string;
          playbackIds?: Array<{ id: string; policy?: string }>;
          raw: Record<string, any>;
          recentAssetIds?: Array<string>;
          reconnectWindowSeconds?: number;
          status?: string;
          updatedAtMs: number;
        } | null
      >;
      getUploadByMuxId: FunctionReference<
        "query",
        "internal",
        { muxUploadId: string },
        {
          _creationTime: number;
          _id: string;
          assetId?: string;
          corsOrigin?: string;
          createdAtMs: number;
          deletedAtMs?: number;
          error?: Record<string, any>;
          muxUploadId: string;
          raw: Record<string, any>;
          status?: string;
          timeoutSeconds?: number;
          updatedAtMs: number;
          uploadUrl?: string;
        } | null
      >;
      listAssets: FunctionReference<
        "query",
        "internal",
        { limit?: number },
        Array<{
          _creationTime: number;
          _id: string;
          aspectRatio?: string;
          createdAtMs: number;
          deletedAtMs?: number;
          durationSeconds?: number;
          liveStreamId?: string;
          maxStoredFrameRate?: number;
          maxStoredResolution?: string;
          muxAssetId: string;
          passthrough?: string;
          playbackIds?: Array<{ id: string; policy?: string }>;
          raw: Record<string, any>;
          status?: string;
          tracks?: Array<{
            id?: string;
            languageCode?: string;
            name?: string;
            status?: string;
            textType?: string;
            type?: string;
          }>;
          updatedAtMs: number;
          uploadId?: string;
        }>
      >;
      listLiveStreams: FunctionReference<
        "query",
        "internal",
        { limit?: number },
        Array<{
          _creationTime: number;
          _id: string;
          createdAtMs: number;
          deletedAtMs?: number;
          muxLiveStreamId: string;
          playbackIds?: Array<{ id: string; policy?: string }>;
          raw: Record<string, any>;
          recentAssetIds?: Array<string>;
          reconnectWindowSeconds?: number;
          status?: string;
          updatedAtMs: number;
        }>
      >;
      listRecentEvents: FunctionReference<
        "query",
        "internal",
        { limit?: number },
        Array<{
          _creationTime: number;
          _id: string;
          muxEventId?: string;
          objectId?: string;
          objectType?: string;
          occurredAtMs?: number;
          raw: Record<string, any>;
          receivedAtMs: number;
          type: string;
          verified: boolean;
        }>
      >;
      listUploads: FunctionReference<
        "query",
        "internal",
        { limit?: number },
        Array<{
          _creationTime: number;
          _id: string;
          assetId?: string;
          corsOrigin?: string;
          createdAtMs: number;
          deletedAtMs?: number;
          error?: Record<string, any>;
          muxUploadId: string;
          raw: Record<string, any>;
          status?: string;
          timeoutSeconds?: number;
          updatedAtMs: number;
          uploadUrl?: string;
        }>
      >;
    };
    sync: {
      markAssetDeletedPublic: FunctionReference<
        "mutation",
        "internal",
        { muxAssetId: string },
        string | null
      >;
      markLiveStreamDeletedPublic: FunctionReference<
        "mutation",
        "internal",
        { muxLiveStreamId: string },
        string | null
      >;
      markUploadDeletedPublic: FunctionReference<
        "mutation",
        "internal",
        { muxUploadId: string },
        string | null
      >;
      recordWebhookEventPublic: FunctionReference<
        "mutation",
        "internal",
        { event: Record<string, any>; verified: boolean },
        { alreadyProcessed: boolean; eventDocId: string }
      >;
      upsertAssetFromPayloadPublic: FunctionReference<
        "mutation",
        "internal",
        { asset: Record<string, any> },
        string
      >;
      upsertLiveStreamFromPayloadPublic: FunctionReference<
        "mutation",
        "internal",
        { liveStream: Record<string, any> },
        string
      >;
      upsertUploadFromPayloadPublic: FunctionReference<
        "mutation",
        "internal",
        { upload: Record<string, any> },
        string
      >;
    };
    videos: {
      getVideoByMuxAssetId: FunctionReference<
        "query",
        "internal",
        { muxAssetId: string; userId?: string },
        null | {
          asset: {
            _creationTime: number;
            _id: string;
            aspectRatio?: string;
            createdAtMs: number;
            deletedAtMs?: number;
            durationSeconds?: number;
            liveStreamId?: string;
            maxStoredFrameRate?: number;
            maxStoredResolution?: string;
            muxAssetId: string;
            passthrough?: string;
            playbackIds?: Array<{ id: string; policy?: string }>;
            raw: Record<string, any>;
            status?: string;
            tracks?: Array<{
              id?: string;
              languageCode?: string;
              name?: string;
              status?: string;
              textType?: string;
              type?: string;
            }>;
            updatedAtMs: number;
            uploadId?: string;
          };
          metadata:
            | {
                _creationTime: number;
                _id: string;
                createdAtMs: number;
                custom?: Record<string, any>;
                description?: string;
                muxAssetId: string;
                tags?: Array<string>;
                title?: string;
                updatedAtMs: number;
                userId: string;
                visibility?: "private" | "unlisted" | "public";
              }
            | null
            | Array<{
                _creationTime: number;
                _id: string;
                createdAtMs: number;
                custom?: Record<string, any>;
                description?: string;
                muxAssetId: string;
                tags?: Array<string>;
                title?: string;
                updatedAtMs: number;
                userId: string;
                visibility?: "private" | "unlisted" | "public";
              }>;
        }
      >;
      listVideosForUser: FunctionReference<
        "query",
        "internal",
        { limit?: number; userId: string },
        Array<{
          asset: {
            _creationTime: number;
            _id: string;
            aspectRatio?: string;
            createdAtMs: number;
            deletedAtMs?: number;
            durationSeconds?: number;
            liveStreamId?: string;
            maxStoredFrameRate?: number;
            maxStoredResolution?: string;
            muxAssetId: string;
            passthrough?: string;
            playbackIds?: Array<{ id: string; policy?: string }>;
            raw: Record<string, any>;
            status?: string;
            tracks?: Array<{
              id?: string;
              languageCode?: string;
              name?: string;
              status?: string;
              textType?: string;
              type?: string;
            }>;
            updatedAtMs: number;
            uploadId?: string;
          } | null;
          metadata: {
            _creationTime: number;
            _id: string;
            createdAtMs: number;
            custom?: Record<string, any>;
            description?: string;
            muxAssetId: string;
            tags?: Array<string>;
            title?: string;
            updatedAtMs: number;
            userId: string;
            visibility?: "private" | "unlisted" | "public";
          };
        }>
      >;
      upsertVideoMetadata: FunctionReference<
        "mutation",
        "internal",
        {
          custom?: Record<string, any>;
          description?: string;
          muxAssetId: string;
          tags?: Array<string>;
          title?: string;
          userId: string;
          visibility?: "private" | "unlisted" | "public";
        },
        string
      >;
    };
  };
};
