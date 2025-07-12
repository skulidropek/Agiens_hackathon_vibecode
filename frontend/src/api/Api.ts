/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import { ContentType, HttpClient, RequestParams } from "./http-client";

export class Api<
  SecurityDataType = unknown,
> extends HttpClient<SecurityDataType> {
  /**
   * No description
   *
   * @tags Chat
   * @name ChatSessionsCreate
   * @summary Создать новую сессию чата
   * @request POST:/api/chat/sessions
   */
  chatSessionsCreate = (
    data: {
      /** ID пользователя */
      userId?: string;
      /** ID проекта (опционально) */
      projectId?: string;
    },
    params: RequestParams = {},
  ) =>
    this.request<void, any>({
      path: `/api/chat/sessions`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });
  /**
   * No description
   *
   * @tags Chat
   * @name ChatSessionsList
   * @summary Получить список активных сессий
   * @request GET:/api/chat/sessions
   */
  chatSessionsList = (
    query?: {
      /** ID пользователя (фильтр) */
      userId?: string;
      /** Только активные (по умолчанию true) */
      active?: boolean;
    },
    params: RequestParams = {},
  ) =>
    this.request<void, any>({
      path: `/api/chat/sessions`,
      method: "GET",
      query: query,
      ...params,
    });
  /**
   * No description
   *
   * @tags Chat
   * @name ChatSessionsDetail
   * @summary Получить информацию о сессии
   * @request GET:/api/chat/sessions/{sessionId}
   */
  chatSessionsDetail = (sessionId: string, params: RequestParams = {}) =>
    this.request<void, any>({
      path: `/api/chat/sessions/${sessionId}`,
      method: "GET",
      ...params,
    });
  /**
   * No description
   *
   * @tags Chat
   * @name ChatSessionsDelete
   * @summary Завершить сессию чата
   * @request DELETE:/api/chat/sessions/{sessionId}
   */
  chatSessionsDelete = (sessionId: string, params: RequestParams = {}) =>
    this.request<void, any>({
      path: `/api/chat/sessions/${sessionId}`,
      method: "DELETE",
      ...params,
    });
  /**
   * No description
   *
   * @tags Chat
   * @name ChatSessionsHistoryList
   * @summary Получить историю чата по сессии
   * @request GET:/api/chat/sessions/{sessionId}/history
   */
  chatSessionsHistoryList = (
    sessionId: string,
    query?: {
      /** Количество сообщений (по умолчанию 50) */
      limit?: number;
      /** Смещение (по умолчанию 0) */
      offset?: number;
    },
    params: RequestParams = {},
  ) =>
    this.request<void, any>({
      path: `/api/chat/sessions/${sessionId}/history`,
      method: "GET",
      query: query,
      ...params,
    });
  /**
   * No description
   *
   * @tags Chat
   * @name ChatSessionsMessagesCreate
   * @summary Добавить сообщение в историю чата
   * @request POST:/api/chat/sessions/{sessionId}/messages
   */
  chatSessionsMessagesCreate = (
    sessionId: string,
    data: {
      /** Текст сообщения */
      content?: string;
      /** Отправитель */
      sender?: string;
    },
    params: RequestParams = {},
  ) =>
    this.request<void, any>({
      path: `/api/chat/sessions/${sessionId}/messages`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });
}
