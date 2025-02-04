/*
  Copyright JS Foundation and other contributors, https://js.foundation/

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

import {CommentHandler} from './comment-handler';
import {JSXParser} from './jsx-parser';
import {Parser} from './parser';
import {Tokenizer} from './tokenizer';
import {CustomTokenizer} from './custom-tokenizer';

const html_tags= [
    'a',
    'abbr',
    'address',
    'area',
    'article',
    'aside',
    'audio',
    'b',
    'base',
    'bb',
    'bdo',
    'blockquote',
    'body',
    'br',
    'button',
    'canvas',
    'caption',
    'cite',
    'code',
    'col',
    'colgroup',
    'command',
    'datagrid',
    'datalist',
    'dd',
    'del',
    'details',
    'dfn',
    'dialog',
    'div',
    'dl',
    'dt',
    'em',
    'embed',
    'eventsource',
    'fieldset',
    'figcaption',
    'figure',
    'footer',
    'form',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'head',
    'header',
    'hgroup',
    'hr',
    'html',
    'i',
    'iframe',
    'img',
    'input',
    'ins',
    'kbd',
    'label',
    'legend',
    'li',
    'link',
    'map',
    'mark',
    'menu',
    'meter',
    'nav',
    'noscript',
    'object',
    'ol',
    'optgroup',
    'option',
    'output',
    'p',
    'param',
    'pre',
    'progress',
    'q',
    'rp',
    'rt',
    'ruby',
    's',
    'samp',
    'section',
    'select',
    'small',
    'source',
    'span',
    'strong',
    'sub',
    'sup',
    'table',
    'tbody',
    'td',
    'textarea',
    'tfoot',
    'th',
    'thead',
    'time',
    'title',
    'tr',
    'track',
    'u',
    'ul',
    'var',
    'video',
    'wbr'
];

export function parse(code: string, options, delegate) {
    let commentHandler: CommentHandler | null = null;
    const proxyDelegate = (node, metadata) => {
        if (delegate) {
            delegate(node, metadata);
        }
        if (commentHandler) {
            commentHandler.visit(node, metadata);
        }
    };

    let parserDelegate = (typeof delegate === 'function') ? proxyDelegate : null;
    let collectComment = false;
    if (options) {
        collectComment = (typeof options.comment === 'boolean' && options.comment);
        const attachComment = (typeof options.attachComment === 'boolean' && options.attachComment);
        if (collectComment || attachComment) {
            commentHandler = new CommentHandler();
            commentHandler.attach = attachComment;
            options.comment = true;
            parserDelegate = proxyDelegate;
        }
    }

    let isModule = false;
    if (options && typeof options.sourceType === 'string') {
        isModule = (options.sourceType === 'module');
    }

    let parser: Parser;
    if (options && typeof options.jsx === 'boolean' && options.jsx) {
        parser = new JSXParser(code, options, parserDelegate);
    } else {
        parser = new Parser(code, options, parserDelegate);
    }

    const program = isModule ? parser.parseModule() : parser.parseScript();
    const ast = program as any;

    if (collectComment && commentHandler) {
        ast.comments = commentHandler.comments;
    }
    if (parser.config.tokens) {
        ast.tokens = parser.tokens;
    }
    if (parser.config.tolerant) {
        ast.errors = parser.errorHandler.errors;
    }

    return ast;
}

export function parseModule(code: string, options, delegate) {
    const parsingOptions = options || {};
    parsingOptions.sourceType = 'module';
    return parse(code, parsingOptions, delegate);
}

export function parseScript(code: string, options, delegate) {
    const parsingOptions = options || {};
    parsingOptions.sourceType = 'script';
    return parse(code, parsingOptions, delegate);
}

export function tokenize(code: string, options, delegate) {
    const tokenizer = new Tokenizer(code, options);

    const tokens: any = [];

    try {
        while (true) {
            let token = tokenizer.getNextToken();
            if (!token) {
                break;
            }
            if (delegate) {
                token = delegate(token);
            }
            tokens.push(token);
        }
    } catch (e) {
        tokenizer.errorHandler.tolerate(e);
    }

    if (tokenizer.errorHandler.tolerant) {
        tokens.errors = tokenizer.errors();
    }

    return tokens;
}

export function tokenizeC(code: string, options, delegate) {
    const tokenizer = new CustomTokenizer(code, options);

    let tokens: any = [];
    let html_tokens: any = [];

    try {
        while (true) {
            let token = tokenizer.getNextToken();
            if (!token) {
                break;
            }
            if (Object.keys(token).length === 0) {
                continue;
            }

            const value = String(token.value);
            const type = String(token.type);
            if (token.type === 'String') {
                // cut single/double quotes from the string
                // because esprima wraps string to a string
                const unwrappedString = value.slice(
                    1,
                    value.length - 1
                );
                if (isHTML(unwrappedString)) {
                    html_tokens.push(unwrappedString);
                    continue;
                }
                let split_arr = unwrappedString.split(' ');
                split_arr.forEach(function (element, index) {
                    if (element.substring(0, 1) == "'" || element.substring(0, 1) == '"') {
                        element = element.slice(
                            1,
                            element.length - 1
                        );
                    }
                    if (element.substring(0, 1) == "." || element.substring(0, 1) == "#") {
                        element = element.slice(
                            1,
                            element.length
                        );
                    }
                    tokens.push(element);
                }, split_arr);
                continue;
            } else if (token.type === 'Template') {
                // cut backticks from the template
                const len = value.length;
                const isOpenedTemplate = value[0] === '`';
                const isClosedTemplate = value[len - 1] === '`';
                const unwrappedTemplate = value.slice(
                    isOpenedTemplate ? 1 : 0,
                    isClosedTemplate ? len - 1 : len
                );
                if (isHTML(unwrappedTemplate)) {
                    html_tokens.push(unwrappedTemplate);
                    continue;
                }
                let split_arr = unwrappedTemplate.split(' ');
                split_arr.forEach(function (element, index) {
                    if (element.substring(0, 1) == "'" || element.substring(0, 1) == '"') {
                        element = element.slice(
                            1,
                            element.length - 1
                        );
                    }
                    tokens.push(element);
                }, split_arr);
                continue;
            }
            if (delegate) {
                token = delegate(token);
            }

            tokens.push(value);
        }
    } catch (e) {
        tokenizer.errorHandler.tolerate(e);
    }

    if (tokenizer.errorHandler.tolerant) {
        tokens.errors = tokenizer.errors();
    }
    return {tokens,html_tokens};
}

function isHTML(str) {
    const valid_html_tags = html_tags.join('|');
    const regex = new RegExp(`<\/?${valid_html_tags}[\s\S]*>`, "i");
    return regex.test(str);
}

export {Syntax} from './syntax';

// Sync with *.json manifests.
export const version = '4.0.0-dev';
