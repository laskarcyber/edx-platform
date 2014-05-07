/**
 * XBlockContainerView is used to display an xblock which has children, and allows the
 * user to interact with the children.
 */
define(["jquery", "underscore", "gettext", "js/views/feedback_notification",
    "js/views/baseview", "js/views/container", "js/views/xblock", "js/views/components/add_xblock",
    "js/views/modals/edit_xblock", "js/models/xblock_info"],
    function ($, _, gettext, NotificationView, BaseView, ContainerView, XBlockView, AddXBlockComponent,
              EditXBlockModal, XBlockInfo) {

        var XBlockContainerView = BaseView.extend({
            // takes XBlockInfo as a model

            view: 'container_preview',

            initialize: function() {
                BaseView.prototype.initialize.call(this);
                this.noContentElement = this.$('.no-container-content');
                this.xblockView = new ContainerView({
                    el: this.$('.wrapper-xblock'),
                    model: this.model,
                    view: this.view
                });
            },

            render: function(options) {
                var self = this,
                    noContentElement = this.noContentElement,
                    xblockView = this.xblockView,
                    loadingElement = this.$('.ui-loading');
                loadingElement.removeClass('is-hidden');

                // Hide both blocks until we know which one to show
                noContentElement.addClass('is-hidden');
                xblockView.$el.addClass('is-hidden');

                // Add actions to any top level buttons, e.g. "Edit" of the container itself
                self.addButtonActions(this.$el);

                // Render the xblock
                xblockView.render({
                    success: function(xblock) {
                        if (xblockView.hasChildXBlocks()) {
                            xblockView.$el.removeClass('is-hidden');
                            self.onXBlockRefresh(xblockView);
                        } else {
                            noContentElement.removeClass('is-hidden');
                        }
                        loadingElement.addClass('is-hidden');
                        self.delegateEvents();
                    }
                });
            },

            findXBlockElement: function(target) {
                return $(target).closest('[data-locator]');
            },

            getURLRoot: function() {
                return this.xblockView.model.urlRoot;
            },

            onXBlockRefresh: function(xblockView) {
                this.addButtonActions(xblockView.$el);
                this.renderAddXBlockComponents();
            },

            renderAddXBlockComponents: function() {
                var self = this;
                this.$('.add-xblock-component').each(function(index, element) {
                    var component = new AddXBlockComponent({
                        el: element,
                        createComponent: _.bind(self.createComponent, self),
                        collection: self.options.templates
                    });
                    component.render();
                });
            },

            addButtonActions: function(element) {
                var self = this;
                element.find('.edit-button').click(function(event) {
                    var modal,
                        target = event.target,
                        xblockElement = self.findXBlockElement(target);
                    event.preventDefault();
                    modal = new EditXBlockModal({ });
                    modal.edit(xblockElement, self.model,
                        {
                            refresh: function(xblockInfo) {
                                self.refreshXBlock(xblockInfo, xblockElement);
                            }
                        });
                });
                element.find('.duplicate-button').click(function(event) {
                    event.preventDefault();
                    self.duplicateComponent(
                        self.findXBlockElement(event.target)
                    );
                });
                element.find('.delete-button').click(function(event) {
                    event.preventDefault();
                    self.deleteComponent(
                        self.findXBlockElement(event.target)
                    );
                });
            },

            createComponent: function(template, target) {
                var self = this, parentElement, parentLocator, operation, xblockInfo, view;
                parentElement = this.findXBlockElement(target);
                parentLocator = parentElement.data('locator');
                xblockInfo = new XBlockInfo({
                    category: template.category
                });
                view = new XBlockView({
                    model: xblockInfo,
                    view: this.view
                });
                operation = view.create(template, parentLocator);
                operation.done(function() {
                    // TODO: can we refresh just the new component?
                    /*
                     var buttonPanel = parentElement.find('.add-xblock-component');
                     buttonPanel.before(view.$el);
                     view.render();
                     */
                    // Refresh the entire parent so that its new child is shown
                    self.refreshXBlockElement(parentElement);
                });
                return operation;
            },

            duplicateComponent: function(xblockElement) {
                var self = this,
                    parentElement = self.findXBlockElement(xblockElement.parent());
                this.runOperationShowingMessage(gettext('Duplicating&hellip;'),
                    function() {
                        return $.postJSON(self.getURLRoot(), {
                            duplicate_source_locator: xblockElement.data('locator'),
                            parent_locator: parentElement.data('locator')
                        }, function(data) {
                            var scrollOffset, duplicatedElement;

                            // get the original element's scroll offset
                            scrollOffset = self.getScrollOffset(xblockElement);

                            // copy the element
                            duplicatedElement = xblockElement.clone(false);

                            // place it after the original element
                            xblockElement.after(duplicatedElement);

                            // update its locator id
                            duplicatedElement.attr('data-locator', data.locator);

                            // scroll the window so that the new element is in the original location
                            self.setScrollOffset(duplicatedElement, scrollOffset);

                            // have it refresh itself
                            self.refreshXBlockElement(duplicatedElement);
                        });
                    });
            },

            deleteComponent: function(xblockElement) {
                var self = this;
                this.confirmThenRunOperation(gettext('Delete this component?'),
                    gettext('Deleting this component is permanent and cannot be undone.'),
                    gettext('Yes, delete this component'),
                    function() {
                        self.runOperationShowingMessage(gettext('Deleting&hellip;'),
                            function() {
                                return $.ajax({
                                    type: 'DELETE',
                                    url: self.getURLRoot() + "/" +
                                        xblockElement.data('locator') + "?" +
                                        $.param({recurse: true, all_versions: true})
                                }).success(function() {
                                    xblockElement.remove();
                                });
                            });
                    });
            },

            refreshXBlockElement: function(xblockElement) {
                this.refreshXBlock(
                    new XBlockInfo({
                        id: xblockElement.data('locator')
                    }),
                    xblockElement
                );
            },

            refreshXBlock: function(xblockInfo, xblockElement) {
                var self = this, temporaryView;

                // There is only one Backbone view created on the container page, which is
                // for the container xblock itself. Any child xblocks rendered inside the
                // container do not get a Backbone view. Thus, create a temporary XBlock
                // around the child element so that it can be refreshed.
                temporaryView = new XBlockView({
                    el: xblockElement,
                    model: xblockInfo,
                    view: this.view
                });
                temporaryView.render({
                    success: function() {
                        temporaryView.unbind();  // Remove the temporary view
                        self.onXBlockRefresh(temporaryView);
                    }
                });
            }
        });

        return XBlockContainerView;
    }); // end define();
