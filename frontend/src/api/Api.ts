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

import { ContentType, HttpClient } from "./http-client";
import type { RequestParams } from "./http-client";

export class Api<
  SecurityDataType = unknown,
> extends HttpClient<SecurityDataType> {
  /**
   * No description
   *
   * @tags AI
   * @name AiInitCreate
   * @summary Инициализация AI сервиса
   * @request POST:/api/ai/init
   */
  aiInitCreate = (data: object, params: RequestParams = {}) =>
    this.request<void, any>({
      path: `/api/ai/init`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });
  /**
   * No description
   *
   * @tags AI
   * @name AiChatCreate
   * @summary Обычный чат с AI
   * @request POST:/api/ai/chat
   */
  aiChatCreate = (data: object, params: RequestParams = {}) =>
    this.request<void, any>({
      path: `/api/ai/chat`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });
  /**
   * No description
   *
   * @tags AI
   * @name AiChatStreamCreate
   * @summary Стриминг чата с AI
   * @request POST:/api/ai/chat/stream
   */
  aiChatStreamCreate = (data: object, params: RequestParams = {}) =>
    this.request<void, any>({
      path: `/api/ai/chat/stream`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });
  /**
   * No description
   *
   * @tags AI
   * @name AiHealthList
   * @summary Проверка здоровья AI сервиса
   * @request GET:/api/ai/health
   */
  aiHealthList = (params: RequestParams = {}) =>
    this.request<void, any>({
      path: `/api/ai/health`,
      method: "GET",
      ...params,
    });
  /**
   * No description
   *
   * @tags AI
   * @name AiConfigList
   * @summary Получение конфигурации AI сервиса
   * @request GET:/api/ai/config
   */
  aiConfigList = (params: RequestParams = {}) =>
    this.request<void, any>({
      path: `/api/ai/config`,
      method: "GET",
      ...params,
    });
  /**
   * No description
   *
   * @tags AI
   * @name AiCacheClearCreate
   * @summary Очистка кэша AI сервиса
   * @request POST:/api/ai/cache/clear
   */
  aiCacheClearCreate = (params: RequestParams = {}) =>
    this.request<void, any>({
      path: `/api/ai/cache/clear`,
      method: "POST",
      ...params,
    });
  /**
   * No description
   *
   * @tags AI
   * @name AiCacheInfoList
   * @summary Получение информации о кэше AI
   * @request GET:/api/ai/cache/info
   */
  aiCacheInfoList = (params: RequestParams = {}) =>
    this.request<void, any>({
      path: `/api/ai/cache/info`,
      method: "GET",
      ...params,
    });
  /**
   * No description
   *
   * @tags Chat
   * @name ChatSessionsCreate
   * @summary Создать новую чат-сессию
   * @request POST:/api/chat/sessions
   */
  chatSessionsCreate = (data: object, params: RequestParams = {}) =>
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
   * @summary Получить список всех сессий
   * @request GET:/api/chat/sessions
   */
  chatSessionsList = (params: Requestimage.pngParams = {}) =>
    this.request<void, any>({
      path: `/api/chat/sessions`,
      method: "GET",
      ...params,
    });
  /**
   * No description
   *
   * @tags Chat
   * @name ChatSessionsDetail
   * @summary Получить сессию по ID
   * @request GET:/api/chat/sessions/{id}
   */
  chatSessionsDetail = (id: string, params: RequestParams = {}) =>
    this.request<void, any>({
      path: `/api/chat/sessions/${id}`,
      method: "GET",
      ...params,
    });
  /**
   * No description
   *
   * @tags Chat
   * @name ChatSessionsDelete
   * @summary Удалить сессию по ID
   * @request DELETE:/api/chat/sessions/{id}
   */
  chatSessionsDelete = (id: string, params: RequestParams = {}) =>
    this.request<void, any>({
      path: `/api/chat/sessions/${id}`,
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
  /**
   * No description
   *
   * @tags Files
   * @name FilesList
   * @summary Получить список файлов в рабочей директории
   * @request GET:/api/files
   */
  filesList = (
    query?: {
      /** Рекурсивно искать файлы */
      recursive?: boolean;
      /** Фильтр по имени файла */
      filter?: string;
    },
    params: RequestParams = {},
  ) =>
    this.request<
      {
        success?: boolean;
        data?: any[];
        timestamp?: string;
      },
      any
    >({
      path: `/api/files`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Files
   * @name FilesDetail
   * @summary Получить содержимое файла или директории
   * @request GET:/api/files/{path}
   */
  filesDetail = (path: string, params: RequestParams = {}) =>
    this.request<
      {
        success?: boolean;
        data?: any[];
        timestamp?: string;
      },
      any
    >({
      path: `/api/files/${path}`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Files
   * @name FilesCreate
   * @summary Создать или обновить файл
   * @request POST:/api/files/{path}
   */
  filesCreate = (
    path: string,
    data: {
      content?: string;
      /** @default "utf-8" */
      encoding?: string;
    },
    params: RequestParams = {},
  ) =>
    this.request<
      {
        success?: boolean;
        data?: any;
        message?: string;
        timestamp?: string;
      },
      any
    >({
      path: `/api/files/${path}`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Files
   * @name FilesDelete
   * @summary Удалить файл или директорию
   * @request DELETE:/api/files/{path}
   */
  filesDelete = (path: string, params: RequestParams = {}) =>
    this.request<
      {
        success?: boolean;
        data?: null;
        message?: string;
        timestamp?: string;
      },
      any
    >({
      path: `/api/files/${path}`,
      method: "DELETE",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags ProjectAI
   * @name ProjectsInitCreate
   * @summary Инициализация AI сервиса для проекта
   * @request POST:/api/projects/{projectId}/init
   */
  projectsInitCreate = (
    projectId: string,
    data: object,
    params: RequestParams = {},
  ) =>
    this.request<void, any>({
      path: `/api/projects/${projectId}/init`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });
  /**
   * No description
   *
   * @tags ProjectAI
   * @name ProjectsChatCreate
   * @summary Чат с AI в контексте проекта
   * @request POST:/api/projects/{projectId}/chat
   */
  projectsChatCreate = (
    projectId: string,
    data: object,
    params: RequestParams = {},
  ) =>
    this.request<void, any>({
      path: `/api/projects/${projectId}/chat`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });
  /**
   * No description
   *
   * @tags ProjectAI
   * @name ProjectsChatStreamCreate
   * @summary Стриминг чата с AI в контексте проекта
   * @request POST:/api/projects/{projectId}/chat/stream
   */
  projectsChatStreamCreate = (
    projectId: string,
    data: object,
    params: RequestParams = {},
  ) =>
    this.request<void, any>({
      path: `/api/projects/${projectId}/chat/stream`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });
  /**
   * No description
   *
   * @tags ProjectAI
   * @name ProjectsHealthList
   * @summary Проверка здоровья AI сервиса для проекта
   * @request GET:/api/projects/{projectId}/health
   */
  projectsHealthList = (projectId: string, params: RequestParams = {}) =>
    this.request<void, any>({
      path: `/api/projects/${projectId}/health`,
      method: "GET",
      ...params,
    });
  /**
   * No description
   *
   * @tags ProjectAI
   * @name ProjectsConfigList
   * @summary Получение конфигурации AI сервиса для проекта
   * @request GET:/api/projects/{projectId}/config
   */
  projectsConfigList = (projectId: string, params: RequestParams = {}) =>
    this.request<void, any>({
      path: `/api/projects/${projectId}/config`,
      method: "GET",
      ...params,
    });
  /**
   * No description
   *
   * @tags ProjectAI
   * @name ProjectsCacheClearCreate
   * @summary Очистка кэша AI сервиса для проекта
   * @request POST:/api/projects/{projectId}/cache/clear
   */
  projectsCacheClearCreate = (projectId: string, params: RequestParams = {}) =>
    this.request<void, any>({
      path: `/api/projects/${projectId}/cache/clear`,
      method: "POST",
      ...params,
    });
  /**
   * No description
   *
   * @tags ProjectFiles
   * @name FilesProjectDetail
   * @summary Получить список файлов проекта
   * @request GET:/api/files/project/{projectId}
   */
  filesProjectDetail = (
    projectId: string,
    query?: {
      /** Рекурсивно искать файлы */
      recursive?: boolean;
      /** Фильтр по имени файла */
      filter?: string;
    },
    params: RequestParams = {},
  ) =>
    this.request<
      {
        success?: boolean;
        data?: any[];
        message?: string;
        timestamp?: string;
      },
      any
    >({
      path: `/api/files/project/${projectId}`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags ProjectFiles
   * @name FilesProjectDetail2
   * @summary Получить содержимое файла или директории в проекте
   * @request GET:/api/files/project/{projectId}/{path}
   * @originalName filesProjectDetail
   * @duplicate
   */
  filesProjectDetail2 = (
    projectId: string,
    path: string,
    params: RequestParams = {},
  ) =>
    this.request<
      {
        success?: boolean;
        data?: any[];
        timestamp?: string;
      },
      any
    >({
      path: `/api/files/project/${projectId}/${path}`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags ProjectFiles
   * @name FilesProjectCreate
   * @summary Создать или обновить файл в проекте
   * @request POST:/api/files/project/{projectId}/{path}
   */
  filesProjectCreate = (
    projectId: string,
    path: string,
    data: {
      content?: string;
      /** @default "utf-8" */
      encoding?: string;
    },
    params: RequestParams = {},
  ) =>
    this.request<
      {
        success?: boolean;
        data?: any;
        message?: string;
        timestamp?: string;
      },
      any
    >({
      path: `/api/files/project/${projectId}/${path}`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags ProjectFiles
   * @name FilesProjectDelete
   * @summary Удалить файл или директорию в проекте
   * @request DELETE:/api/files/project/{projectId}/{path}
   */
  filesProjectDelete = (
    projectId: string,
    path: string,
    params: RequestParams = {},
  ) =>
    this.request<
      {
        success?: boolean;
        data?: null;
        message?: string;
        timestamp?: string;
      },
      any
    >({
      path: `/api/files/project/${projectId}/${path}`,
      method: "DELETE",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags ProjectFiles
   * @name FilesProjectStatsList
   * @summary Получить статистику проекта
   * @request GET:/api/files/project/{projectId}/stats
   */
  filesProjectStatsList = (projectId: string, params: RequestParams = {}) =>
    this.request<
      {
        success?: boolean;
        data?: object;
        timestamp?: string;
      },
      any
    >({
      path: `/api/files/project/${projectId}/stats`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Projects
   * @name ProjectsList
   * @summary Получить список всех проектов
   * @request GET:/api/projects
   */
  projectsList = (params: RequestParams = {}) =>
    this.request<
      {
        projects?: any[];
        activeProject?: any;
      },
      any
    >({
      path: `/api/projects`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Projects
   * @name ProjectsCreate
   * @summary Создать новый проект
   * @request POST:/api/projects
   */
  projectsCreate = (data: any, params: RequestParams = {}) =>
    this.request<any, void>({
      path: `/api/projects`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Projects
   * @name ProjectsStatsList
   * @summary Получить статистику проектов
   * @request GET:/api/projects/stats
   */
  projectsStatsList = (params: RequestParams = {}) =>
    this.request<
      {
        totalProjects?: number;
        gitProjects?: number;
        localProjects?: number;
        activeProject?: string;
      },
      any
    >({
      path: `/api/projects/stats`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Projects
   * @name ProjectsDetail
   * @summary Получить проект по ID
   * @request GET:/api/projects/{id}
   */
  projectsDetail = (id: string, params: RequestParams = {}) =>
    this.request<any, void>({
      path: `/api/projects/${id}`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Projects
   * @name ProjectsDelete
   * @summary Удалить проект
   * @request DELETE:/api/projects/{id}
   */
  projectsDelete = (id: string, params: RequestParams = {}) =>
    this.request<void, void>({
      path: `/api/projects/${id}`,
      method: "DELETE",
      ...params,
    });

  updateFile = (filePath: string, content: string, projectId: string) => {
    return this.request<any, any>({
      path: `/api/files/project/${projectId}`,
      method: "POST",
      body: { filePath, content },
      type: ContentType.Json,
    });
  }

  getTerminals = (projectId: string) => {
    return this.request<any, any>({
      path: `/api/terminals?projectId=${projectId}`,
      method: "GET",
    });
  }
}
